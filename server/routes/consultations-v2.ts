import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { realtimeService } from "../services/realtime.service";
import type { CompleteConsultationRequest, RealtimeEvent } from "@shared/api";
import { sendJsonError } from "../lib/send-json-error";
import { notifyFollowUpScheduled } from "../services/followup-notifications.service";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { sendStaffEmail } from "../services/outbound-email.service";
import { sendSms } from "../services/sms.service";
import { createNotification } from "../services/app-notifications.service";

const router = Router();

function isMissingConsultationColumnError(message: string, columns: string[]): boolean {
  const lowered = message.toLowerCase();
  return columns.some((column) => {
    const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase();
    return (
      lowered.includes(`could not find the '${escaped}' column of 'consultations'`) ||
      new RegExp(`column\\s+["']?${escaped}["']?\\s+does not exist`, "i").test(message)
    );
  });
}

function isMissingConsultationOptionalColumnError(message: string): boolean {
  return isMissingConsultationColumnError(message, [
    "ai_summary",
    "ai_transcript",
    "recording_consent",
    "handwriting_strokes",
    "handwriting_image_path",
    "structured_prescription",
    "workflow_status",
    "payment_notified_at",
  ]);
}

const completeSchema = z.object({
  clinicId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  diagnosis: z.string().optional(),
  treatmentPlan: z.string().optional(),
  notes: z.string().optional(),
  handwritingStrokes: z.unknown().optional(),
  aiTranscript: z.string().optional(),
  aiSummary: z.string().optional(),
  recordingConsent: z.boolean().optional(),
  prescription: z
    .object({
      notes: z.string().optional(),
      followUpDate: z.string().optional(), // YYYY-MM-DD
      items: z
        .array(
          z.object({
            name: z.string().min(1),
            dosage: z.string().optional(),
            frequency: z.string().optional(),
            duration: z.string().optional(),
            quantity: z.number().int().positive().optional(),
            instructions: z.string().optional(),
          })
        )
        .min(1),
    })
    .optional(),
} satisfies Record<keyof CompleteConsultationRequest, any>);

/**
 * POST /api/consultations/complete
 * Doctor completes consultation and creates prescription (+items).
 */
router.post(
  "/complete",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const apptExisting = await supabase
      .from("appointments")
      .select("id, clinic_id, doctor_user_id, status, patient_id")
      .eq("id", parsed.data.appointmentId)
      .single();
    if (apptExisting.error || !apptExisting.data) {
      return sendJsonError(res, 404, "Appointment not found", "NOT_FOUND");
    }
    const row = apptExisting.data;
    if (row.clinic_id !== parsed.data.clinicId || row.patient_id !== parsed.data.patientId) {
      return sendJsonError(res, 400, "Appointment does not match clinic or patient", "VALIDATION_ERROR");
    }
    if (req.user?.role === "doctor" || req.user?.role === "independent") {
      if (row.doctor_user_id !== req.user.userId) {
        return sendJsonError(res, 403, "Not assigned to this appointment", "FORBIDDEN");
      }
    }
    if (row.status === "completed") {
      return sendJsonError(res, 400, "Consultation already completed for this visit", "VALIDATION_ERROR");
    }

    const dupConsult = await supabase
      .from("consultations")
      .select("id")
      .eq("appointment_id", parsed.data.appointmentId)
      .maybeSingle();
    if (dupConsult.error) {
      return sendJsonError(res, 500, dupConsult.error.message, "INTERNAL_SERVER_ERROR");
    }
    if (dupConsult.data) {
      return sendJsonError(res, 409, "Consultation already exists for this appointment", "CONFLICT");
    }

    // Mark appointment as in_consultation first
    const appt = await supabase
      .from("appointments")
      .update({ status: "in_consultation" })
      .eq("id", parsed.data.appointmentId)
      .select("*")
      .single();
    if (appt.error || !appt.data) return sendJsonError(res, 404, "Appointment not found", "NOT_FOUND");

    const structuredPrescription =
      parsed.data.prescription?.items && parsed.data.prescription.items.length > 0
        ? { items: parsed.data.prescription.items }
        : null;

    // Create consultation
    const consultationInsert: Record<string, unknown> = {
      clinic_id: parsed.data.clinicId,
      appointment_id: parsed.data.appointmentId,
      patient_id: parsed.data.patientId,
      doctor_user_id: req.user?.userId,
      diagnosis: parsed.data.diagnosis ?? null,
      treatment_plan: parsed.data.treatmentPlan ?? null,
      notes: parsed.data.notes ?? null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      workflow_status: "submitted_awaiting_payment",
      structured_prescription: structuredPrescription,
      handwriting_strokes: parsed.data.handwritingStrokes ?? null,
    };

    const aiTranscript = parsed.data.aiTranscript?.trim();
    const aiSummary = parsed.data.aiSummary?.trim();
    if (aiTranscript) consultationInsert.ai_transcript = aiTranscript;
    if (aiSummary) consultationInsert.ai_summary = aiSummary;
    if (parsed.data.recordingConsent === true) {
      consultationInsert.recording_consent = true;
    }

    let consultationRes = await supabase
      .from("consultations")
      .insert(consultationInsert)
      .select("*")
      .single();

    if (
      consultationRes.error &&
      isMissingConsultationOptionalColumnError(consultationRes.error.message)
    ) {
      console.warn(
        "[consultations] optional columns missing in schema; retrying with safe subset:",
        consultationRes.error.message
      );
      delete consultationInsert.handwriting_strokes;
      delete consultationInsert.ai_transcript;
      delete consultationInsert.ai_summary;
      delete consultationInsert.recording_consent;
      delete consultationInsert.structured_prescription;
      delete consultationInsert.workflow_status;
      consultationRes = await supabase
        .from("consultations")
        .insert(consultationInsert)
        .select("*")
        .single();
    }

    if (consultationRes.error || !consultationRes.data) {
      return sendJsonError(res, 500, consultationRes.error?.message || "Failed to create consultation", "INTERNAL_SERVER_ERROR");
    }

    // Create prescription
    const rxRes = await supabase
      .from("prescriptions")
      .insert({
        clinic_id: parsed.data.clinicId,
        consultation_id: consultationRes.data.id,
        patient_id: parsed.data.patientId,
        doctor_user_id: req.user?.userId,
        follow_up_date: parsed.data.prescription?.followUpDate ?? null,
        notes: parsed.data.prescription?.notes ?? null,
      })
      .select("*")
      .single();

    if (rxRes.error || !rxRes.data) {
      return sendJsonError(res, 500, rxRes.error?.message || "Failed to create prescription", "INTERNAL_SERVER_ERROR");
    }

    if (parsed.data.prescription?.items?.length) {
      const items = parsed.data.prescription.items.map((it) => ({
        prescription_id: rxRes.data!.id,
        name: it.name,
        dosage: it.dosage ?? null,
        frequency: it.frequency ?? null,
        duration: it.duration ?? null,
        quantity: it.quantity ?? null,
        instructions: it.instructions ?? null,
      }));
      const itemsRes = await supabase.from("prescription_items").insert(items).select("*");
      if (itemsRes.error) {
        return sendJsonError(res, 500, itemsRes.error.message || "Failed to create prescription items", "INTERNAL_SERVER_ERROR");
      }
      (rxRes.data as any).items = itemsRes.data ?? [];
    } else {
      (rxRes.data as any).items = [];
    }

    if (parsed.data.prescription?.followUpDate) {
      const dueYmd = parsed.data.prescription.followUpDate;
      const { data: fuRow, error: fuErr } = await supabase
        .from("followups")
        .insert({
          clinic_id: parsed.data.clinicId,
          patient_id: parsed.data.patientId,
          doctor_user_id: req.user!.userId,
          source_consultation_id: consultationRes.data.id,
          due_date: dueYmd,
          status: "scheduled",
          notes: "Follow-up from consultation",
        })
        .select("id")
        .maybeSingle();
      if (fuErr) {
        console.warn("[followups] insert skipped:", fuErr.message);
      } else if (fuRow) {
        void notifyFollowUpScheduled({
          clinicId: parsed.data.clinicId,
          patientId: parsed.data.patientId,
          doctorUserId: req.user!.userId,
          dueDateYmd: dueYmd,
          notes: "Follow-up from consultation",
        }).catch((e) => console.warn("[followups] notify:", e));
      }
    }

    // Mark appointment completed
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", parsed.data.appointmentId);

    const event: RealtimeEvent = {
      type: "consultation.completed",
      clinicId: parsed.data.clinicId,
      at: new Date().toISOString(),
      payload: {
        appointmentId: parsed.data.appointmentId,
        consultationId: consultationRes.data.id,
        prescriptionId: rxRes.data.id,
      },
    };
    realtimeService.emit(event);

    const adminClient = getSupabaseClient();
    const { data: receptionists } = await adminClient
      .from("users")
      .select("id")
      .eq("clinic_id", parsed.data.clinicId)
      .eq("role", "receptionist")
      .eq("is_active", true);

    for (const receptionist of receptionists || []) {
      void createNotification({
        userId: receptionist.id,
        clinicId: parsed.data.clinicId,
        type: "consultation_completed",
        title: "Consultation completed",
        message: "A patient is ready for billing or discharge.",
        data: {
          appointmentId: parsed.data.appointmentId,
          consultationId: consultationRes.data.id,
          prescriptionId: rxRes.data.id,
          patientId: parsed.data.patientId,
        },
      });
    }

    void createNotification({
      userId: req.user!.userId,
      clinicId: parsed.data.clinicId,
      type: "prescription_saved",
      title: "Prescription saved",
      message: "Prescription saved successfully for this consultation.",
      data: {
        appointmentId: parsed.data.appointmentId,
        consultationId: consultationRes.data.id,
        prescriptionId: rxRes.data.id,
      },
    });

    return res.json({
      success: true,
      consultation: consultationRes.data,
      prescription: rxRes.data,
    });
  }
);

/**
 * GET /api/consultations/doctor/recent?clinicId=
 * Recent completed consultations for the logged-in doctor with patient + prescription lines.
 */
router.get(
  "/doctor/recent",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId?: string }).clinicId || req.user?.clinicId;
    const limit = Math.min(100, Math.max(1, parseInt(String((req.query as { limit?: string }).limit || "40"), 10) || 40));
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const doctorId = req.user!.userId;
    const { data, error } = await supabase
      .from("consultations")
      .select(
        `
        id,
        created_at,
        diagnosis,
        notes,
        patient_id,
        patients ( id, name, phone ),
        prescriptions (
          id,
          notes,
          created_at,
          prescription_items ( id, name, dosage, frequency, duration, instructions )
        )
      `
      )
      .eq("clinic_id", clinicId)
      .eq("doctor_user_id", doctorId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");

    type RxRow = {
      id: string;
      notes: string | null;
      created_at: string;
      prescription_items: Array<{
        id: string;
        name: string;
        dosage: string | null;
        frequency: string | null;
        duration: string | null;
        instructions: string | null;
      }> | null;
    };

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const pr = row.patients as { id?: string; name?: string; phone?: string | null } | null | undefined;
      const patients = Array.isArray(pr) ? pr[0] : pr;
      const rxRaw = row.prescriptions as RxRow | RxRow[] | null | undefined;
      const rxArr = Array.isArray(rxRaw) ? rxRaw : rxRaw ? [rxRaw] : [];
      const prescription = rxArr[0];
      const itemsRaw = prescription?.prescription_items;
      const items = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];
      return {
        consultationId: row.id,
        createdAt: row.created_at,
        diagnosis: row.diagnosis,
        notes: row.notes,
        patient: patients
          ? { id: patients.id, name: patients.name, phone: patients.phone ?? null }
          : { id: row.patient_id, name: "Patient", phone: null as string | null },
        prescription: prescription
          ? {
              id: prescription.id,
              notes: prescription.notes,
              createdAt: prescription.created_at,
              items,
            }
          : null,
      };
    });

    return res.json({ success: true, consultations: rows });
  }
);

/**
 * GET /api/consultations/patients/:patientId/history
 */
router.get(
  "/patients/:patientId/history",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as any).clinicId || req.user?.clinicId;
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", req.params.patientId)
      .order("created_at", { ascending: false });

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, consultations: data ?? [] });
  }
);

const handwritingSchema = z.object({
  strokes: z.unknown(),
  handwritingImagePath: z.string().optional().nullable(),
});

/**
 * PATCH /api/consultations/:consultationId/handwriting
 */
router.patch(
  "/:consultationId/handwriting",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = handwritingSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const existing = await supabase
      .from("consultations")
      .select("id, clinic_id, doctor_user_id")
      .eq("id", req.params.consultationId)
      .single();
    if (existing.error || !existing.data) return sendJsonError(res, 404, "Consultation not found", "NOT_FOUND");

    if (req.user?.role !== "super-admin") {
      if (existing.data.clinic_id !== req.user?.clinicId) {
        return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
      }
      if (existing.data.doctor_user_id !== req.user?.userId) {
        return sendJsonError(res, 403, "Not your consultation", "FORBIDDEN");
      }
    }

    let { data, error } = await supabase
      .from("consultations")
      .update({
        handwriting_strokes: parsed.data.strokes as object,
        handwriting_image_path: parsed.data.handwritingImagePath ?? null,
      })
      .eq("id", req.params.consultationId)
      .select("*")
      .single();

    if (error && isMissingConsultationOptionalColumnError(error.message)) {
      return sendJsonError(
        res,
        503,
        "Database migration required: consultations.handwriting_strokes",
        "MIGRATION_REQUIRED"
      );
    }

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to update", "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, consultation: data });
  }
);

/**
 * GET /api/consultations/payment-alerts?clinicId=&since=ISO
 */
router.get(
  "/payment-alerts",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId?: string }).clinicId || req.user?.clinicId;
    const since =
      (req.query as { since?: string }).since ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    let q = supabase
      .from("consultations")
      .select("id, appointment_id, patient_id, payment_notified_at, workflow_status")
      .eq("clinic_id", clinicId)
      .eq("workflow_status", "paid")
      .not("payment_notified_at", "is", null)
      .gte("payment_notified_at", since)
      .order("payment_notified_at", { ascending: false })
      .limit(30);

    if (req.user?.role === "doctor" || req.user?.role === "independent") {
      q = q.eq("doctor_user_id", req.user!.userId);
    }

    const { data, error } = await q;
    if (error) {
      if (isMissingConsultationColumnError(error.message, ["workflow_status", "payment_notified_at"])) {
        return res.json({ success: true, alerts: [] });
      }
      return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    }
    return res.json({ success: true, alerts: data ?? [] });
  }
);

// ────────────────────────────────────────────────────────────
// POST /api/consultations/close-day
// Doctor closes the day — marks completed consultations as day_closed,
// pending ones as incomplete, stores daily summary.
// ────────────────────────────────────────────────────────────
const closeDaySchema = z.object({
  clinicId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  completedIds: z.array(z.string()).default([]),
  pendingIds: z.array(z.string()).default([]),
});

router.post(
  "/close-day",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = closeDaySchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const { clinicId, date, completedIds, pendingIds } = parsed.data;
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();
    const doctorId = req.user!.userId;

    // Mark completed consultations as day_closed
    if (completedIds.length > 0) {
      await supabase
        .from("consultations")
        .update({ workflow_status: "day_closed", day_closed: true })
        .in("id", completedIds)
        .eq("clinic_id", clinicId);
    }

    // Mark pending ones as incomplete
    if (pendingIds.length > 0) {
      await supabase
        .from("consultations")
        .update({ workflow_status: "incomplete" })
        .in("id", pendingIds)
        .eq("clinic_id", clinicId);
    }

    // Count prescriptions for completed consultations today
    const { count: rxCount } = await supabase
      .from("prescriptions")
      .select("id", { count: "exact", head: true })
      .in("consultation_id", completedIds);

    // Sum billing for today (best effort)
    const { data: billRows } = await supabase
      .from("bills")
      .select("total_amount")
      .in("consultation_id", completedIds)
      .eq("payment_status", "paid");

    const revenue = (billRows || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

    // Upsert daily summary
    const { data: summary, error: summaryError } = await supabase
      .from("daily_summaries")
      .upsert(
        {
          doctor_id: doctorId,
          clinic_id: clinicId,
          summary_date: date,
          total_seen: completedIds.length,
          total_pending: pendingIds.length,
          total_prescriptions: rxCount || 0,
          revenue,
          closed_at: new Date().toISOString(),
        },
        { onConflict: "doctor_id,summary_date" }
      )
      .select()
      .single();

    if (summaryError) {
      console.warn("[close-day] daily_summaries upsert failed:", summaryError.message);
    }

    // Notify receptionist that doctor has closed the day
    try {
      await supabase.from("notifications").insert({
        user_id: doctorId,
        clinic_id: clinicId,
        type: "day_closed",
        title: "Day Closed",
        message: `You have closed the day. ${completedIds.length} patients seen, ${pendingIds.length} pending.`,
        data: { totalSeen: completedIds.length, totalPending: pendingIds.length, revenue, date },
      });
    } catch { /* non-critical */ }

    return res.json({
      success: true,
      summary: {
        totalSeen: completedIds.length,
        totalPending: pendingIds.length,
        totalPrescriptions: rxCount || 0,
        revenue,
        date,
      },
      dailySummary: summary || null,
    });
  }
);

// ────────────────────────────────────────────────────────────
// GET /api/consultations/today-summary
// Returns today's consultation stats for the close-day modal
// ────────────────────────────────────────────────────────────
router.get(
  "/today-summary",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId?: string }).clinicId || req.user?.clinicId;
    const date = ((req.query as { date?: string }).date) || new Date().toISOString().slice(0, 10);

    if (!clinicId) return sendJsonError(res, 400, "clinicId required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();
    const doctorId = req.user!.userId;

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data: consultations } = await supabase
      .from("consultations")
      .select("id, workflow_status, appointments!inner(patient_id, check_in_time, patients(name, phone))")
      .eq("clinic_id", clinicId)
      .eq("doctor_id", doctorId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .not("workflow_status", "eq", "day_closed");

    return res.json({ success: true, consultations: consultations || [], date });
  }
);

// ────────────────────────────────────────────────────────────
// POST /api/consultations/send-report
// Stores the generated patient report in Supabase Storage and sends patient channels.
// The frontend sends print-ready HTML; it is stored under report.pdf path for the
// clinical workflow contract. A production PDF renderer can replace this without
// changing the route contract.
// ────────────────────────────────────────────────────────────
const sendReportSchema = z.object({
  clinicId: z.string().min(1),
  patientId: z.string().min(1),
  consultationId: z.string().optional(),
  patientName: z.string().min(1),
  patientPhone: z.string().optional(),
  patientEmail: z.string().email().optional().or(z.literal("")),
  doctorName: z.string().min(1),
  clinicName: z.string().min(1),
  summary: z.string().optional(),
  html: z.string().min(100),
});

router.post(
  "/send-report",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = sendReportSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const body = parsed.data;
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== body.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();
    const consultationId = body.consultationId || `manual-${Date.now()}`;
    const path = `patient-reports/${body.clinicId}/${body.patientId}/${consultationId}/report.pdf`;
    const buffer = Buffer.from(body.html, "utf8");

    const { error: uploadError } = await supabase.storage
      .from("patient-reports")
      .upload(path, buffer, {
        contentType: "text/html; charset=utf-8",
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) return sendJsonError(res, 500, uploadError.message, "INTERNAL_SERVER_ERROR");

    const { data: signed, error: signedError } = await supabase.storage
      .from("patient-reports")
      .createSignedUrl(path, 7 * 24 * 60 * 60);

    if (signedError || !signed?.signedUrl) {
      return sendJsonError(res, 500, signedError?.message || "Could not sign report URL", "INTERNAL_SERVER_ERROR");
    }

    if (body.consultationId) {
      await supabase
        .from("consultations")
        .update({
          report_url: signed.signedUrl,
          report_url_expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          ai_summary: body.summary || null,
        })
        .eq("id", body.consultationId);
    }

    const summary = body.summary || "Please follow your medicines as advised by your doctor.";
    const delivery = {
      whatsapp: false,
      email: false,
      sms: false,
    };

    if (body.patientPhone) {
      const whatsappMessage = `Dear ${body.patientName}, your prescription from Dr. ${body.doctorName} at ${body.clinicName} is ready. Here are your health notes: ${summary}\n\nReport: ${signed.signedUrl}\nGet well soon.`;
      const wa = await sendWhatsAppMessage(body.patientPhone, whatsappMessage);
      delivery.whatsapp = wa.success;

      const sms = await sendSms(
        body.patientPhone,
        `Hi ${body.patientName}, prescription from Dr.${body.doctorName} is ready. Follow medicines as advised. Report: ${signed.signedUrl} - ${body.clinicName}`
      );
      delivery.sms = sms.success;
    }

    if (body.patientEmail) {
      const email = await sendStaffEmail({
        to: body.patientEmail,
        subject: `Your Health Report - ${body.clinicName}`,
        text: `Dear ${body.patientName},\n\n${summary}\n\nYour report is available for 7 days:\n${signed.signedUrl}\n\nWishing you a speedy recovery.\n- Dr. ${body.doctorName}, ${body.clinicName}`,
      });
      delivery.email = email.ok;
    }

    return res.json({
      success: true,
      url: signed.signedUrl,
      path,
      delivery,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
);

export default router;

