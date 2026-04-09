import { Router, Request, Response } from "express";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import {
  fetchAssignedDoctorIds,
  receptionistMustCoverDoctor,
} from "../services/receptionist-scope.service";
import { sendJsonError } from "../lib/send-json-error";

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
    if (!effectiveClinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== effectiveClinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
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

    if (req.user?.role === "receptionist") {
      const assigned = await fetchAssignedDoctorIds(req.user!);
      if (assigned.length === 0) {
        return res.json({ success: true, queue: [] });
      }
      if (doctorId) {
        const gate = receptionistMustCoverDoctor(req.user!, doctorId, assigned);
        if (gate.ok === false) return sendJsonError(res, 403, gate.message, "FORBIDDEN");
        q = q.eq("doctor_user_id", doctorId);
      } else {
        q = q.in("doctor_user_id", assigned);
      }
    } else if (doctorId) {
      q = q.eq("doctor_user_id", doctorId);
    }

    const { data, error } = await q.order("appointment_time", { ascending: true });
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, queue: data ?? [] });
  }
);

export default router;

