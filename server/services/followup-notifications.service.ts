import { getSupabaseClient } from "../config/supabase";
import { sendStaffEmailToMany } from "./outbound-email.service";
import { sendWhatsAppMessage } from "./whatsapp.service";

/** Twilio Content API variable "1" — short date (e.g. 12/1) to match approved templates */
function formatShortDateUs(ymd: string): string {
  try {
    return new Date(ymd + "T12:00:00").toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return ymd;
  }
}

/**
 * If TWILIO_FOLLOWUP_CONTENT_SID is set, sends WhatsApp via Content API (same pattern as Twilio curl ContentSid + ContentVariables).
 * Variable keys "1" and "2" must match your Twilio template. Override defaults with TWILIO_FOLLOWUP_TEMPLATE_VAR2_DEFAULT.
 */
async function sendFollowUpPatientWhatsApp(
  phone: string,
  kind: "scheduled" | "completed",
  dueDateYmd: string,
  doctorName: string,
  bodyPlainText: string
): Promise<void> {
  const contentSidScheduled = process.env.TWILIO_FOLLOWUP_CONTENT_SID?.trim();
  const contentSidCompleted = process.env.TWILIO_FOLLOWUP_COMPLETED_CONTENT_SID?.trim();
  const var2Default = process.env.TWILIO_FOLLOWUP_TEMPLATE_VAR2_DEFAULT?.trim() || "3pm";

  const sid =
    kind === "scheduled"
      ? contentSidScheduled || null
      : contentSidCompleted || null;

  if (sid) {
    const v1 = formatShortDateUs(dueDateYmd);
    const v2 = kind === "scheduled" ? var2Default : doctorName;
    const sent = await sendWhatsAppMessage(phone, "", {
      twilioContent: {
        contentSid: sid,
        variables: { "1": v1, "2": v2 },
      },
    });
    if (!sent.success) {
      console.warn(`[followup-notify] Twilio Content API failed (${kind}):`, sent.error);
    }
    return;
  }

  const sent = await sendWhatsAppMessage(phone, bodyPlainText);
  if (!sent.success) {
    console.warn(`[followup-notify] WhatsApp (${kind}) failed:`, sent.error);
  }
}

function formatDueDate(ymd: string): string {
  try {
    return new Date(ymd + "T12:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return ymd;
  }
}

async function loadContext(
  clinicId: string,
  patientId: string,
  doctorUserId: string
): Promise<{
  patientName: string;
  patientPhone: string | null;
  clinicName: string;
  clinicEmail: string | null;
  doctorName: string;
  receptionEmails: string[];
}> {
  const db = getSupabaseClient();
  const [{ data: patient }, { data: clinic }, { data: doctor }, { data: receptionists }] = await Promise.all([
    db.from("patients").select("name, phone").eq("id", patientId).maybeSingle(),
    db.from("clinics").select("name, email").eq("id", clinicId).maybeSingle(),
    db.from("users").select("name").eq("id", doctorUserId).maybeSingle(),
    db
      .from("users")
      .select("email")
      .eq("clinic_id", clinicId)
      .eq("role", "receptionist")
      .not("email", "is", null),
  ]);

  const emails: string[] = (receptionists || [])
    .map((r: { email?: string | null }) => r.email?.trim())
    .filter((e): e is string => Boolean(e));

  const clinicMail = clinic?.email?.trim();
  if (clinicMail && !emails.includes(clinicMail)) emails.push(clinicMail);

  const extra = process.env.STAFF_NOTIFICATION_EMAIL?.trim();
  if (extra && !emails.includes(extra)) emails.push(extra);

  return {
    patientName: patient?.name || "Patient",
    patientPhone: patient?.phone ?? null,
    clinicName: clinic?.name || "Clinic",
    clinicEmail: clinic?.email ?? null,
    doctorName: doctor?.name || "Doctor",
    receptionEmails: [...new Set(emails)],
  };
}

/**
 * Email reception (and clinic inbox) + WhatsApp patient when a follow-up is scheduled.
 */
export async function notifyFollowUpScheduled(params: {
  clinicId: string;
  patientId: string;
  doctorUserId: string;
  dueDateYmd: string;
  notes?: string | null;
}): Promise<void> {
  const { clinicId, patientId, doctorUserId, dueDateYmd, notes } = params;
  const ctx = await loadContext(clinicId, patientId, doctorUserId);
  const dateLabel = formatDueDate(dueDateYmd);
  const noteLine = notes?.trim() ? `\nNotes: ${notes.trim()}` : "";

  const emailSubject = `[${ctx.clinicName}] Follow-up scheduled — ${ctx.patientName}`;
  const emailBody = `A follow-up was scheduled at ${ctx.clinicName}.

Patient: ${ctx.patientName}
Doctor: ${ctx.doctorName}
Due date: ${dateLabel}${noteLine}

(Reception: coordinate the visit as needed.)`;

  if (ctx.receptionEmails.length > 0) {
    const results = await sendStaffEmailToMany(ctx.receptionEmails, {
      subject: emailSubject,
      text: emailBody,
    });
    const failed = results.filter((r) => !r.ok && !r.skipped);
    if (failed.length) {
      console.warn("[followup-notify] some staff emails failed:", failed.map((f) => f.error).join("; "));
    }
  } else {
    console.warn("[followup-notify] no reception/clinic email; staff notification skipped");
  }

  if (ctx.patientPhone) {
    const detail = notes?.trim() ? ` Details: ${notes.trim()}` : "";
    const wa = `Hi ${ctx.patientName}, ${ctx.clinicName} has scheduled a follow-up with Dr. ${ctx.doctorName} on ${dateLabel}.${detail} Please contact the clinic if you need to change the date. Thank you.`;
    await sendFollowUpPatientWhatsApp(ctx.patientPhone, "scheduled", dueDateYmd, ctx.doctorName, wa);
  } else {
    console.warn("[followup-notify] patient has no phone; WhatsApp skipped");
  }
}

/**
 * Email reception + WhatsApp patient when a follow-up is marked completed.
 */
export async function notifyFollowUpCompleted(params: {
  clinicId: string;
  patientId: string;
  doctorUserId: string;
  dueDateYmd: string;
  notes?: string | null;
}): Promise<void> {
  const { clinicId, patientId, doctorUserId, dueDateYmd, notes } = params;
  const ctx = await loadContext(clinicId, patientId, doctorUserId);
  const dateLabel = formatDueDate(dueDateYmd);
  const noteLine = notes?.trim() ? `\nNotes: ${notes.trim()}` : "";

  const emailSubject = `[${ctx.clinicName}] Follow-up completed — ${ctx.patientName}`;
  const emailBody = `A follow-up visit was marked completed at ${ctx.clinicName}.

Patient: ${ctx.patientName}
Doctor: ${ctx.doctorName}
Scheduled for: ${dateLabel}${noteLine}`;

  if (ctx.receptionEmails.length > 0) {
    await sendStaffEmailToMany(ctx.receptionEmails, {
      subject: emailSubject,
      text: emailBody,
    });
  }

  if (ctx.patientPhone) {
    const wa = `Hi ${ctx.patientName}, your follow-up with Dr. ${ctx.doctorName} at ${ctx.clinicName} has been completed (visit that was due ${dateLabel}).${notes?.trim() ? ` Note: ${notes.trim()}` : ""} Thank you.`;
    await sendFollowUpPatientWhatsApp(ctx.patientPhone, "completed", dueDateYmd, ctx.doctorName, wa);
  }
}
