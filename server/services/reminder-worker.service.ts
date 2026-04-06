import { getSupabaseClient } from "../config/supabase";
import { sendWhatsAppMessage } from "./whatsapp.service";

function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Sends WhatsApp reminders for followups due **tomorrow** (one day before visit).
 * Idempotent via whatsapp_reminder_sent_at.
 */
export async function processFollowUpRemindersOnce(): Promise<{ processed: number; errors: string[] }> {
  const supabase = getSupabaseClient();
  const due = tomorrowYmd();
  const errors: string[] = [];

  const { data: rows, error } = await supabase
    .from("followups")
    .select("id, clinic_id, patient_id, doctor_user_id, due_date, status, whatsapp_reminder_sent_at")
    .eq("due_date", due)
    .eq("status", "scheduled")
    .is("whatsapp_reminder_sent_at", null);

  if (error) {
    errors.push(error.message);
    return { processed: 0, errors };
  }

  let processed = 0;
  for (const row of rows || []) {
    try {
      const [{ data: patient }, { data: clinic }, { data: doctor }] = await Promise.all([
        supabase.from("patients").select("phone, name").eq("id", row.patient_id).single(),
        supabase.from("clinics").select("name").eq("id", row.clinic_id).single(),
        supabase.from("users").select("name").eq("id", row.doctor_user_id).single(),
      ]);

      const phone = patient?.phone;
      if (!phone) {
        errors.push(`followup ${row.id}: no patient phone`);
        continue;
      }

      const clinicName = clinic?.name || "Clinic";
      const doctorName = doctor?.name || "Doctor";
      const patientName = patient?.name || "Patient";
      const dateLabel = new Date(row.due_date + "T12:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const msg = `Hi ${patientName}, reminder from ${clinicName}: your follow-up with Dr. ${doctorName} is scheduled for ${dateLabel}. Please reply or call the clinic to confirm. Thank you.`;

      const sent = await sendWhatsAppMessage(phone, msg);
      if (!sent.success) {
        errors.push(`followup ${row.id}: ${sent.error || "send failed"}`);
        continue;
      }

      const { error: upErr } = await supabase
        .from("followups")
        .update({ whatsapp_reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", row.id);

      if (upErr) {
        errors.push(`followup ${row.id}: ${upErr.message}`);
        continue;
      }
      processed += 1;
    } catch (e) {
      errors.push(`followup ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (processed > 0 || errors.length > 0) {
    console.log(`[reminders] due=${due} processed=${processed} errors=${errors.length}`);
  }
  return { processed, errors };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startFollowUpReminderWorker(): void {
  const ms = Math.max(
    60_000,
    parseInt(process.env.REMINDER_WORKER_INTERVAL_MS || "", 10) || 15 * 60 * 1000
  );
  if (process.env.REMINDER_WORKER_DISABLED === "true") {
    console.log("[reminders] worker disabled via REMINDER_WORKER_DISABLED=true");
    return;
  }
  console.log(`[reminders] worker every ${ms}ms`);
  void processFollowUpRemindersOnce();
  timer = setInterval(() => {
    void processFollowUpRemindersOnce();
  }, ms);
}

export function stopFollowUpReminderWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
