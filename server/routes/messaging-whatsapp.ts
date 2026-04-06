import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { processFollowUpRemindersOnce } from "../services/reminder-worker.service";

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
      return res.status(403).json({ error: "Clinic access denied" });
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
    if (pe || !patient) return res.status(404).json({ error: "Patient not found" });
    if (patient.clinic_id !== parsed.data.clinicId) {
      return res.status(400).json({ error: "Patient does not belong to this clinic" });
    }

    const result = await sendWhatsAppMessage(patient.phone, parsed.data.message);
    if (!result.success) {
      return res.status(502).json({ error: result.error || "WhatsApp send failed" });
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
      if (!secret || String(req.query.secret || "") !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    const r = await processFollowUpRemindersOnce();
    return res.json({ success: true, ...r });
  })
);

export default router;
