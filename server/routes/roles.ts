import { Router } from "express";
import {
  getRoles,
  getRole,
  createRole,
  editRole,
  deleteRole,
  getRolePermissions,
  updateRolePermissions,
  assignRoleToUser,
  getAvailablePermissions,
} from "../controllers/roles.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// All role routes require authentication
router.use(authMiddleware);

/**
 * GET /api/roles
 * Get all roles with pagination
 * Query params: page, limit, search, isSystem
 */
router.get("/", getRoles);

/**
 * GET /api/roles/permissions
 * Get all available permissions in the system
 */
router.get("/permissions", getAvailablePermissions);

/**
 * GET /api/roles/:roleId
 * Get single role details including user count
 */
router.get("/:roleId", getRole);

/**
 * POST /api/roles
 * Create custom role (admin operation)
 * Body: name, description, permissions[]
 */
router.post("/", createRole);

/**
 * PUT /api/roles/:roleId
 * Edit role details (admin operation)
 * Cannot edit system roles
 * Body: name, description, permissions[]
 */
router.put("/:roleId", editRole);

/**
 * DELETE /api/roles/:roleId
 * Delete custom role (admin operation)
 * Cannot delete system roles
 */
router.delete("/:roleId", deleteRole);

/**
 * GET /api/roles/:roleId/permissions
 * Get permissions for a role
 */
router.get("/:roleId/permissions", getRolePermissions);

/**
 * PUT /api/roles/:roleId/permissions
 * Update role permissions (admin operation)
 * Body: permissions[]
 */
router.put("/:roleId/permissions", updateRolePermissions);

/**
 * POST /api/roles/assign/:userId
 * Assign role to user (admin operation)
 * Body: roleName
 */
router.post("/assign/:userId", assignRoleToUser);

export default router;
