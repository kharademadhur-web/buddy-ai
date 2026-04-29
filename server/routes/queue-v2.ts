import { Router, Request, Response } from "express";
import { getSupabaseClient } from "../config/supabase";
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
    try {
      const { doctorId, clinicId } = req.query as { doctorId?: string; clinicId?: string };

      const effectiveClinicId = clinicId || req.user?.clinicId;
      if (!effectiveClinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
      if (req.user?.role !== "super-admin" && req.user?.clinicId !== effectiveClinicId) {
        return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
      }

      const supabase = getSupabaseClient();
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
      } else {
        // For doctors/independent without explicit filter, default to own queue.
        if (req.user?.role === "doctor" || req.user?.role === "independent") {
          q = q.eq("doctor_user_id", req.user.userId);
        }
      }

      const { data, error } = await q.order("appointment_time", { ascending: true });
      if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
      return res.json({ success: true, queue: data ?? [] });
    } catch (err) {
      console.error("[queue-v2] unhandled error", err);
      return sendJsonError(res, 500, err instanceof Error ? err.message : "Queue failed", "INTERNAL_SERVER_ERROR");
    }
  }
);

export default router;

