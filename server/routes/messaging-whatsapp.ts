import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { processFollowUpRemindersOnce } from "../services/reminder-worker.service";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

const sendSchema = z.object({
  clinicId: z.string().uuid(),
  patientId: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

/**
 * POST /api/messaging/whatsapp/send
 * Reception/clinic staff sends a plain-text WhatsApp to a patient (configure Twilio or Meta).
 */
router.post(
  "/whatsapp/send",
  authMiddleware,
  requireRole("receptionist", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid body");

    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const { data: patient, error: pe } = await supabase
      .from("patients")
      .select("phone, name, clinic_id")
      .eq("id", parsed.data.patientId)
      .single();
    if (pe || !patient) return sendJsonError(res, 404, "Patient not found", "NOT_FOUND");
    if (patient.clinic_id !== parsed.data.clinicId) {
      return sendJsonError(res, 400, "Patient does not belong to this clinic", "VALIDATION_ERROR");
    }

    const result = await sendWhatsAppMessage(patient.phone, parsed.data.message);
    if (!result.success) {
      return sendJsonError(res, 502, result.error || "WhatsApp send failed", "UPSTREAM_ERROR");
    }
    return res.json({
      success: true,
      messageId: result.messageId,
      status: result.status,
    });
  })
);

/**
 * GET /api/messaging/cron/reminders?secret=
 * Optional: call from Azure Logic App / cron if you disable the in-process worker.
 */
router.get(
  "/cron/reminders",
  asyncHandler(async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      const secret = process.env.REMINDER_CRON_SECRET?.trim();
      const headerSecret = String(req.headers["x-reminder-secret"] || req.headers.authorization || "")
        .replace(/^Bearer\s+/i, "")
        .trim();
      const querySecret = String(req.query.secret || "").trim();
      const provided = headerSecret || querySecret;
      if (!secret || provided !== secret) {
        return sendJsonError(res, 401, "Unauthorized", "UNAUTHORIZED");
      }
    }
    const r = await processFollowUpRemindersOnce();
    return res.json({ success: true, ...r });
  })
);

export default router;
