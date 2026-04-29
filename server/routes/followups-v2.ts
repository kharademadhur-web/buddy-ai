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
  const channel = String(row.notification_channel ?? "");
  const minutes = Number(row.reminder_minutes_before ?? 0);
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_user_id,
    scheduledDate: row.due_date ? `${row.due_date}T12:00:00.000Z` : null,
    notes: row.notes ?? "",
    status: row.status === "scheduled" ? "scheduled" : row.status === "completed" ? "completed" : "cancelled",
    notificationChannel: ["whatsapp", "sms", "email"].includes(channel) ? channel : "whatsapp",
    reminderMinutesBefore: Number.isFinite(minutes) && minutes >= 0 ? minutes : 0,
  };
}

/**
 * Insert/update a followup row. Some deployments lack the
 * `notification_channel` / `reminder_minutes_before` columns, so we retry
 * without them on a 42703 (undefined_column) error to stay schema-tolerant.
 */
async function followupUpsertWithSchemaFallback<T>(
  doInsert: (extras: Record<string, unknown>) => Promise<{ data: T | null; error: { code?: string; message: string } | null }>,
  extras: Record<string, unknown>
): Promise<{ data: T | null; error: { code?: string; message: string } | null }> {
  const first = await doInsert(extras);
  if (
    first.error &&
    (first.error.code === "42703" ||
      /notification_channel|reminder_minutes_before/i.test(first.error.message))
  ) {
    const stripped: Record<string, unknown> = { ...extras };
    delete stripped.notification_channel;
    delete stripped.reminder_minutes_before;
    return doInsert(stripped);
  }
  return first;
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

    // Selecting "*" so optional columns (notification_channel, reminder_minutes_before)
    // come through if they exist in the DB; mapFollowUpRow tolerates either schema.
    const { data, error } = await supabase
      .from("followups")
      .select("*")
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

    const { data: inserted, error } = await followupUpsertWithSchemaFallback(
      async (extras) => {
        const { data, error } = await supabase
          .from("followups")
          .insert({
            clinic_id: b.clinicId,
            patient_id: b.patientId,
            doctor_user_id: b.doctorId,
            due_date: dueYmd,
            status: "scheduled",
            notes: b.notes?.trim() || null,
            ...extras,
          })
          .select("*")
          .single();
        return {
          data,
          error: error
            ? { code: (error as { code?: string }).code, message: error.message }
            : null,
        };
      },
      {
        notification_channel: b.notificationChannel ?? "whatsapp",
        reminder_minutes_before:
          typeof b.reminderMinutesBefore === "number" ? b.reminderMinutesBefore : 0,
      }
    );

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
    const optionalExtras: Record<string, unknown> = {};
    if (body.data.notificationChannel !== undefined) {
      optionalExtras.notification_channel = body.data.notificationChannel;
    }
    if (typeof body.data.reminderMinutesBefore === "number") {
      optionalExtras.reminder_minutes_before = body.data.reminderMinutesBefore;
    }

    const { data: updated, error } = await followupUpsertWithSchemaFallback(
      async (extras) => {
        const { data, error } = await supabase
          .from("followups")
          .update({ ...patch, ...extras })
          .eq("id", id)
          .select("*")
          .single();
        return {
          data,
          error: error
            ? { code: (error as { code?: string }).code, message: error.message }
            : null,
        };
      },
      optionalExtras
    );

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
