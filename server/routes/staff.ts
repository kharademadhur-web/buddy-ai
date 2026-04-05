import { Router, Request, Response } from "express";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";

const router = Router();

/**
 * GET /api/staff/doctors
 * List doctors for the current clinic (reception uses this to book).
 */
router.get(
  "/doctors",
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
      .from("users")
      .select("id, user_id, name, role, clinic_id")
      .eq("clinic_id", clinicId)
      .in("role", ["doctor", "independent"])
      .order("name", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, doctors: data ?? [] });
  }
);

export default router;

