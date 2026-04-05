import { Router } from "express";
import {
  getUsers,
  getUser,
  editUser,
  forcePasswordReset,
  lockAccount,
  unlockAccount,
  deactivateUser,
  getUserAuditLogs,
  getUserSessions,
  signOutFromDevice,
  signOutFromAllDevices,
} from "../controllers/users.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * GET /api/users
 * Get all users with pagination, search, filtering
 * Query params: page, limit, search, role, status
 */
router.get("/", getUsers);

/**
 * GET /api/users/:userId
 * Get single user details including sessions and biometric tokens
 */
router.get("/:userId", getUser);

/**
 * PUT /api/users/:userId
 * Edit user details (admin operation)
 * Body: name, email, role, status, clinicId
 */
router.put("/:userId", editUser);

/**
 * POST /api/users/:userId/reset-password
 * Force password reset (admin operation)
 * Generates new temporary password and sends to user
 */
router.post("/:userId/reset-password", forcePasswordReset);

/**
 * POST /api/users/:userId/lock
 * Lock user account (admin operation)
 * Prevents user from logging in for 24 hours
 */
router.post("/:userId/lock", lockAccount);

/**
 * POST /api/users/:userId/unlock
 * Unlock user account (admin operation)
 */
router.post("/:userId/unlock", unlockAccount);

/**
 * DELETE /api/users/:userId
 * Deactivate user (admin operation)
 * Sets status to suspended and invalidates all sessions
 */
router.delete("/:userId", deactivateUser);

/**
 * GET /api/users/:userId/audit-logs
 * Get audit logs for user
 * Shows login history, password changes, role assignments, etc.
 */
router.get("/:userId/audit-logs", getUserAuditLogs);

/**
 * GET /api/users/:userId/sessions
 * Get user's active sessions (devices)
 */
router.get("/:userId/sessions", getUserSessions);

/**
 * POST /api/users/:userId/sessions/:deviceId/logout
 * Sign out user from specific device
 * Body: deviceId
 */
router.post("/:userId/sessions/logout", signOutFromDevice);

/**
 * POST /api/users/:userId/sessions/logout-all
 * Sign out user from all devices
 */
router.post("/:userId/sessions/logout-all", signOutFromAllDevices);

export default router;
