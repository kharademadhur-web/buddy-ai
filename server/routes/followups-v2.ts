import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { sendJsonError } from "../lib/send-json-error";
import { notifyFollowUpCompleted, notifyFollowUpScheduled } from "../services/followup-notifications.service";

const router = Router();

function supabaseForUser(req: Request) {
  return req.user?.role === "super-admin"
    ? getSupabaseClient()
    : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
}

function assertClinic(req: Request, clinicId: string): boolean {
  if (req.user?.role === "super-admin") return true;
  return req.user?.clinicId === clinicId;
}

const scheduleSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  clinicId: z.string().uuid(),
  scheduledDate: z.string(), // ISO datetime
  notes: z.string().optional(),
  notificationChannel: z.enum(["whatsapp", "sms", "email"]).optional(),
  reminderMinutesBefore: z.number().optional(),
});

function ymdFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ValidationError("Invalid scheduledDate");
  return d.toISOString().slice(0, 10);
}

function mapFollowUpRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_user_id,
    scheduledDate: row.due_date ? `${row.due_date}T12:00:00.000Z` : null,
    notes: row.notes ?? "",
    status: row.status === "scheduled" ? "scheduled" : row.status === "completed" ? "completed" : "cancelled",
    notificationChannel: "whatsapp",
  };
}

/**
 * GET /api/followups/upcoming
 */
router.get(
  "/upcoming",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query.clinicId as string) || req.user?.clinicId;
    if (!clinicId) throw new ValidationError("clinicId is required");
    if (!assertClinic(req, clinicId)) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = supabaseForUser(req);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("followups")
      .select("id, patient_id, doctor_user_id, due_date, status, notes")
      .eq("clinic_id", clinicId)
      .in("status", ["scheduled"])
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(100);

    if (error) {
      return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    }

    return res.json({
      success: true,
      followUps: (data || []).map((row) => mapFollowUpRow(row as Record<string, unknown>)),
    });
  })
);

/**
 * POST /api/followups/schedule
 */
router.post(
  "/schedule",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body");
    const b = parsed.data;
    if (!assertClinic(req, b.clinicId)) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    if (req.user?.role === "doctor" || req.user?.role === "independent") {
      if (req.user.userId !== b.doctorId) {
        return sendJsonError(res, 403, "You can only schedule for yourself", "FORBIDDEN");
      }
    }

    const supabase = supabaseForUser(req);
    const dueYmd = ymdFromIso(b.scheduledDate);

    const { data: inserted, error } = await supabase
      .from("followups")
      .insert({
        clinic_id: b.clinicId,
        patient_id: b.patientId,
        doctor_user_id: b.doctorId,
        due_date: dueYmd,
        status: "scheduled",
        notes: b.notes?.trim() || null,
      })
      .select("id, patient_id, doctor_user_id, due_date, status, notes")
      .single();

    if (error || !inserted) {
      return sendJsonError(res, 500, error?.message || "Failed to create follow-up", "INTERNAL_SERVER_ERROR");
    }

    void notifyFollowUpScheduled({
      clinicId: b.clinicId,
      patientId: b.patientId,
      doctorUserId: b.doctorId,
      dueDateYmd: dueYmd,
      notes: b.notes ?? null,
    }).catch((e) => console.warn("[followups] notify scheduled:", e));

    return res.status(201).json({
      success: true,
      message: "Follow-up scheduled successfully",
      followUp: mapFollowUpRow(inserted as Record<string, unknown>),
    });
  })
);

/**
 * PUT /api/followups/:id
 */
router.put(
  "/:id",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = z
      .object({
        patientId: z.string().uuid().optional(),
        doctorId: z.string().uuid().optional(),
        clinicId: z.string().uuid().optional(),
        scheduledDate: z.string().optional(),
        notes: z.string().optional(),
        notificationChannel: z.enum(["whatsapp", "sms", "email"]).optional(),
        reminderMinutesBefore: z.number().optional(),
      })
      .safeParse(req.body);
    if (!body.success) throw new ValidationError("Invalid body");

    const supabase = supabaseForUser(req);
    const { data: existing, error: exErr } = await supabase.from("followups").select("*").eq("id", id).single();
    if (exErr || !existing) return sendJsonError(res, 404, "Follow-up not found", "NOT_FOUND");

    if (!assertClinic(req, existing.clinic_id)) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const patch: Record<string, unknown> = {};
    if (body.data.scheduledDate) patch.due_date = ymdFromIso(body.data.scheduledDate);
    if (body.data.notes !== undefined) patch.notes = body.data.notes?.trim() || null;

    const { data: updated, error } = await supabase
      .from("followups")
      .update(patch)
      .eq("id", id)
      .select("id, patient_id, doctor_user_id, due_date, status, notes")
      .single();

    if (error || !updated) {
      return sendJsonError(res, 500, error?.message || "Update failed", "INTERNAL_SERVER_ERROR");
    }

    return res.json({
      success: true,
      message: "Follow-up updated successfully",
      followUp: mapFollowUpRow(updated as Record<string, unknown>),
    });
  })
);

/**
 * PUT /api/followups/:id/complete
 */
router.put(
  "/:id/complete",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const supabase = supabaseForUser(req);

    const { data: existing, error: exErr } = await supabase.from("followups").select("*").eq("id", id).single();
    if (exErr || !existing) return sendJsonError(res, 404, "Follow-up not found", "NOT_FOUND");

    if (!assertClinic(req, existing.clinic_id)) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const { data: updated, error } = await supabase
      .from("followups")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, patient_id, doctor_user_id, due_date, status, notes, clinic_id")
      .single();

    if (error || !updated) {
      return sendJsonError(res, 500, error?.message || "Update failed", "INTERNAL_SERVER_ERROR");
    }

    void notifyFollowUpCompleted({
      clinicId: updated.clinic_id,
      patientId: updated.patient_id,
      doctorUserId: updated.doctor_user_id,
      dueDateYmd: String(updated.due_date).slice(0, 10),
      notes: updated.notes,
    }).catch((e) => console.warn("[followups] notify completed:", e));

    return res.json({
      success: true,
      message: "Follow-up marked as completed",
      followUp: mapFollowUpRow(updated as Record<string, unknown>),
    });
  })
);

export default router;
