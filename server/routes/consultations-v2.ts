import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { realtimeService } from "../services/realtime.service";
import type { CompleteConsultationRequest, RealtimeEvent } from "@shared/api";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

function isMissingConsultationOptionalColumnError(message: string): boolean {
  return /Could not find the '(ai_summary|ai_transcript|recording_consent|handwriting_strokes|handwriting_image_path|structured_prescription)' column of 'consultations'|column .* does not exist/i.test(
    message
  );
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
      const { error: fuErr } = await supabase.from("followups").insert({
        clinic_id: parsed.data.clinicId,
        patient_id: parsed.data.patientId,
        doctor_user_id: req.user!.userId,
        source_consultation_id: consultationRes.data.id,
        due_date: parsed.data.prescription.followUpDate,
        status: "scheduled",
        notes: "Follow-up from consultation",
      });
      if (fuErr) {
        console.warn("[followups] insert skipped:", fuErr.message);
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
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, alerts: data ?? [] });
  }
);

export default router;

