import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware.js";
import {
  toggleClinicAccess,
  getClinicAccessStatus,
} from "../controllers/clinic-access.controller.js";

const router = Router();

/**
 * All clinic access routes are protected and require super-admin role
 */

/**
 * PUT /api/clinic-access/:clinicId
 * Toggle clinic read-only mode (enable/disable access)
 * Body: { readOnlyMode: boolean, readOnlyReason?: string }
 */
router.put(
  "/:clinicId",
  authMiddleware,
  requireRole("super-admin"),
  toggleClinicAccess
);

/**
 * GET /api/clinic-access/:clinicId/status
 * Get clinic access status
 */
router.get(
  "/:clinicId/status",
  authMiddleware,
  requireRole("super-admin"),
  getClinicAccessStatus
);

export default router;
