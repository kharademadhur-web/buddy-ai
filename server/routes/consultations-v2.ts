import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { realtimeService } from "../services/realtime.service";
import type { CompleteConsultationRequest, RealtimeEvent } from "@shared/api";

const router = Router();

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
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
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
      return res.status(404).json({ error: "Appointment not found" });
    }
    const row = apptExisting.data;
    if (row.clinic_id !== parsed.data.clinicId || row.patient_id !== parsed.data.patientId) {
      return res.status(400).json({ error: "Appointment does not match clinic or patient" });
    }
    if (req.user?.role === "doctor" || req.user?.role === "independent") {
      if (row.doctor_user_id !== req.user.userId) {
        return res.status(403).json({ error: "Not assigned to this appointment" });
      }
    }
    if (row.status === "completed") {
      return res.status(400).json({ error: "Consultation already completed for this visit" });
    }

    const dupConsult = await supabase
      .from("consultations")
      .select("id")
      .eq("appointment_id", parsed.data.appointmentId)
      .maybeSingle();
    if (dupConsult.error) {
      return res.status(500).json({ error: dupConsult.error.message });
    }
    if (dupConsult.data) {
      return res.status(409).json({ error: "Consultation already exists for this appointment" });
    }

    // Mark appointment as in_consultation first
    const appt = await supabase
      .from("appointments")
      .update({ status: "in_consultation" })
      .eq("id", parsed.data.appointmentId)
      .select("*")
      .single();
    if (appt.error || !appt.data) return res.status(404).json({ error: "Appointment not found" });

    const structuredPrescription =
      parsed.data.prescription?.items && parsed.data.prescription.items.length > 0
        ? { items: parsed.data.prescription.items }
        : null;

    // Create consultation
    const consultationRes = await supabase
      .from("consultations")
      .insert({
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
        ai_transcript: parsed.data.aiTranscript ?? null,
        ai_summary: parsed.data.aiSummary ?? null,
        recording_consent: parsed.data.recordingConsent ?? false,
      })
      .select("*")
      .single();

    if (consultationRes.error || !consultationRes.data) {
      return res.status(500).json({ error: consultationRes.error?.message || "Failed to create consultation" });
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
      return res.status(500).json({ error: rxRes.error?.message || "Failed to create prescription" });
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
        return res.status(500).json({ error: itemsRes.error.message || "Failed to create prescription items" });
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
 * GET /api/consultations/patients/:patientId/history
 */
router.get(
  "/patients/:patientId/history",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as any).clinicId || req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ error: "clinicId is required" });
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
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

    if (error) return res.status(500).json({ error: error.message });
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
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const existing = await supabase
      .from("consultations")
      .select("id, clinic_id, doctor_user_id")
      .eq("id", req.params.consultationId)
      .single();
    if (existing.error || !existing.data) return res.status(404).json({ error: "Consultation not found" });

    if (req.user?.role !== "super-admin") {
      if (existing.data.clinic_id !== req.user?.clinicId) {
        return res.status(403).json({ error: "Clinic access denied" });
      }
      if (existing.data.doctor_user_id !== req.user?.userId) {
        return res.status(403).json({ error: "Not your consultation" });
      }
    }

    const { data, error } = await supabase
      .from("consultations")
      .update({
        handwriting_strokes: parsed.data.strokes as object,
        handwriting_image_path: parsed.data.handwritingImagePath ?? null,
      })
      .eq("id", req.params.consultationId)
      .select("*")
      .single();

    if (error || !data) return res.status(500).json({ error: error?.message || "Failed to update" });
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
    if (!clinicId) return res.status(400).json({ error: "clinicId is required" });
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
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
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, alerts: data ?? [] });
  }
);

export default router;

