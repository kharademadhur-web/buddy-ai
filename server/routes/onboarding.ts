import { Router, RequestHandler } from "express";
import { authMiddleware, requireRole, optionalAuthMiddleware } from "../middleware/auth.middleware.js";
import {
  createClinic,
  addDoctor,
  addReceptionist,
  getOnboardingStatus,
} from "../controllers/onboarding.controller.js";

const router = Router();

/**
 * DEVELOPMENT ENDPOINT: Test endpoint without authentication
 * Remove this in production
 */
router.post(
  "/test/clinic",
  optionalAuthMiddleware,
  createClinic as RequestHandler
);

/**
 * All onboarding routes are protected and require super-admin role
 */

/**
 * POST /api/onboarding/clinic
 * Create a new clinic (Step 1)
 */
router.post(
  "/clinic",
  authMiddleware,
  requireRole("super-admin", "admin"),
  createClinic as RequestHandler
);

/**
 * POST /api/onboarding/doctor
 * Add a doctor to a clinic (Step 2)
 */
router.post(
  "/doctor",
  authMiddleware,
  requireRole("super-admin", "admin"),
  addDoctor as RequestHandler
);

/**
 * POST /api/onboarding/receptionist
 * Add a receptionist to a clinic (Step 3)
 */
router.post(
  "/receptionist",
  authMiddleware,
  requireRole("super-admin", "admin"),
  addReceptionist as RequestHandler
);

/**
 * GET /api/onboarding/:clinicId/status
 * Get onboarding status for a clinic
 */
router.get(
  "/:clinicId/status",
  authMiddleware,
  requireRole("super-admin", "admin"),
  getOnboardingStatus as RequestHandler
);

export default router;
