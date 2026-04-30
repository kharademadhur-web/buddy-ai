import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { normalizePhoneDigits } from "../services/otp-auth.service";
import { sendJsonError } from "../lib/send-json-error";
import { createNotification } from "../services/app-notifications.service";

const router = Router();

const vitalsSchema = z.object({
  bpSystolic: z.number().int().optional(),
  bpDiastolic: z.number().int().optional(),
  heartRate: z.number().int().optional(),
  temperatureC: z.number().optional(),
  weightKg: z.number().optional(),
  spo2: z.number().int().optional(),
  notes: z.string().optional(),
});

const createSchema = z.object({
  clinicId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  gender: z.enum(["male", "female", "other"]).optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  emergencyContact: z.string().optional(),
  /** If set, must reference an otp_sessions row that is verified for this phone (see POST /api/staff/verify-patient-phone-otp). */
  otpSessionId: z.string().uuid().optional(),
});

const updateNameSchema = z.object({
  name: z.string().min(1).max(120),
});

router.post(
  "/",
  authMiddleware,
  requireRole("receptionist", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    if (parsed.data.otpSessionId) {
      const admin = getSupabaseClient();
      const { data: os, error: oe } = await admin
        .from("otp_sessions")
        .select("contact, contact_type, verified_at")
        .eq("id", parsed.data.otpSessionId)
        .single();
      if (oe || !os?.verified_at) {
        return sendJsonError(res, 400, "Invalid or unverified phone OTP session", "VALIDATION_ERROR");
      }
      if (os.contact_type !== "phone") {
        return sendJsonError(res, 400, "OTP session must be for phone", "VALIDATION_ERROR");
      }
      if (os.contact !== normalizePhoneDigits(parsed.data.phone)) {
        return sendJsonError(res, 400, "Phone does not match verified OTP session", "VALIDATION_ERROR");
      }
    }

    const supabase = getSupabaseClient();

    // Upsert by unique (clinic_id, phone) behavior
    const { data, error } = await supabase
      .from("patients")
      .upsert(
        {
          clinic_id: parsed.data.clinicId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email ?? null,
          date_of_birth: parsed.data.dateOfBirth ?? null,
          gender: parsed.data.gender ?? null,
          medical_history: parsed.data.medicalHistory ?? null,
          allergies: parsed.data.allergies ?? null,
          emergency_contact: parsed.data.emergencyContact ?? null,
          created_by: req.user?.userId ?? null,
        },
        { onConflict: "clinic_id,phone" }
      )
      .select("*")
      .single();

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to save patient", "INTERNAL_SERVER_ERROR");
    if (req.user?.userId) {
      void createNotification({
        userId: req.user.userId,
        clinicId: parsed.data.clinicId,
        type: "new_patient_registered",
        title: "Patient registered",
        message: `${data.name} has been saved to the clinic registry.`,
        data: { patientId: data.id },
      });
    }
    return res.status(201).json({ success: true, patient: data });
  }
);

router.get(
  "/",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const { query, clinicId, limit } = req.query as {
        query?: string;
        clinicId?: string;
        limit?: string;
      };

      const effectiveClinicId = clinicId || req.user?.clinicId;
      if (!effectiveClinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
      if (req.user?.role !== "super-admin" && req.user?.clinicId !== effectiveClinicId) {
        return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
      }

      const supabase = getSupabaseClient();

      let q = supabase.from("patients").select("*").eq("clinic_id", effectiveClinicId);
      if (query) {
        const like = `%${query}%`;
        q = q.or(`name.ilike.${like},phone.ilike.${like}`);
      }
      const take = Math.min(parseInt(limit || "20", 10) || 20, 50);
      const { data, error } = await q.order("updated_at", { ascending: false }).limit(take);
      if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
      return res.json({ success: true, patients: data ?? [] });
    } catch (err) {
      console.error("[patients-v2] unhandled list error", err);
      return sendJsonError(res, 500, err instanceof Error ? err.message : "Patient list failed", "INTERNAL_SERVER_ERROR");
    }
  }
);

/**
 * PATCH /api/patients/:id
 * Name-only update (doctor/reception/admin). Other fields stay unchanged.
 */
router.patch(
  "/:id",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = updateNameSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const clinicId = (req.query as { clinicId?: string }).clinicId || req.user?.clinicId;
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("patients")
      .update({
        name: parsed.data.name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("clinic_id", clinicId)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to update patient", "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, patient: data });
  }
);

router.get(
  "/:id",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as any).clinicId || req.user?.clinicId;
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("id", req.params.id)
      .single();

    if (error || !data) return sendJsonError(res, 404, "Patient not found", "NOT_FOUND");
    return res.json({ success: true, patient: data });
  }
);

/**
 * POST /api/patients/:id/vitals
 * Structured vitals row (reception/doctor; RLS enforces receptionist patient scope).
 */
router.post(
  "/:id/vitals",
  authMiddleware,
  requireRole("receptionist", "doctor", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = vitalsSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const clinicId = (req.query as { clinicId?: string }).clinicId || req.user?.clinicId;
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("patient_vitals")
      .insert({
        patient_id: req.params.id,
        clinic_id: clinicId,
        recorded_by: req.user?.userId ?? null,
        bp_systolic: parsed.data.bpSystolic ?? null,
        bp_diastolic: parsed.data.bpDiastolic ?? null,
        heart_rate: parsed.data.heartRate ?? null,
        temperature_c: parsed.data.temperatureC ?? null,
        weight_kg: parsed.data.weightKg ?? null,
        spo2: parsed.data.spo2 ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select("*")
      .single();

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to save vitals", "INTERNAL_SERVER_ERROR");
    const { data: activeAppointment } = await supabase
      .from("appointments")
      .select("id, doctor_user_id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", req.params.id)
      .in("status", ["checked_in", "in_consultation"])
      .order("appointment_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeAppointment?.doctor_user_id) {
      void createNotification({
        userId: activeAppointment.doctor_user_id,
        clinicId,
        type: "general",
        title: "Patient vitals updated",
        message: "New vitals were recorded for a patient in your queue.",
        data: { patientId: req.params.id, appointmentId: activeAppointment.id, vitalsId: data.id },
      });
    }
    return res.status(201).json({ success: true, vitals: data });
  }
);

/**
 * GET /api/patients/:id/vitals?clinicId=
 */
router.get(
  "/:id/vitals",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId?: string }).clinicId || req.user?.clinicId;
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("patient_vitals")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", req.params.id)
      .order("recorded_at", { ascending: false })
      .limit(20);

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, vitals: data ?? [] });
  }
);

export default router;

