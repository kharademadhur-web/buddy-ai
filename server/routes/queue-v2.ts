import { Router, Request, Response } from "express";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";

const router = Router();

/**
 * GET /api/queue
 * Queue derived from appointments for clinic (optionally doctor).
 * Returns checked-in and in_consultation appointments ordered by time.
 */
router.get(
  "/",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const { doctorId, clinicId } = req.query as { doctorId?: string; clinicId?: string };

    const effectiveClinicId = clinicId || req.user?.clinicId;
    if (!effectiveClinicId) return res.status(400).json({ error: "clinicId is required" });
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== effectiveClinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    let q = supabase
      .from("appointments")
      .select("*")
      .eq("clinic_id", effectiveClinicId)
      .in("status", ["checked_in", "in_consultation"]);

    if (doctorId) q = q.eq("doctor_user_id", doctorId);

    const { data, error } = await q.order("appointment_time", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, queue: data ?? [] });
  }
);

export default router;

