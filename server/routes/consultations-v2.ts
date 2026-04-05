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

    // Mark appointment as in_consultation first
    const appt = await supabase
      .from("appointments")
      .update({ status: "in_consultation" })
      .eq("id", parsed.data.appointmentId)
      .select("*")
      .single();
    if (appt.error || !appt.data) return res.status(404).json({ error: "Appointment not found" });

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

export default router;

