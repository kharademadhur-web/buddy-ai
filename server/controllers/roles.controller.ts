import { RequestHandler } from "express";
import { Role } from "../models/Role";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";

/**
 * Get all roles with pagination
 */
export const getRoles: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isSystem } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }
    if (isSystem !== undefined) {
      filter.isSystem = isSystem === "true";
    }

    const total = await Role.countDocuments(filter);
    const roles = await Role.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ isSystem: -1, createdAt: -1 });

    res.json({
      data: roles,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get roles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get single role details
 */
export const getRole: RequestHandler = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Count users with this role
    const userCount = await User.countDocuments({ role: role.name });

    res.json({
      role,
      userCount,
    });
  } catch (error) {
    console.error("Get role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Create custom role (admin operation)
 */
export const createRole: RequestHandler = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const adminId = req.body.adminId || (req as any).user?.id;

    if (!name || !Array.isArray(permissions)) {
      return res
        .status(400)
        .json({ error: "Name and permissions array required" });
    }

    // Check if role already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(409).json({ error: "Role already exists" });
    }

    // Create role
    const role = new Role({
      name,
      description: description || "",
      permissions,
      isSystem: false,
      createdBy: adminId,
    });

    await role.save();

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "role_created",
      resourceType: "role",
      resourceId: role._id,
      clinicId: req.body.clinicId || "",
      description: `Role created: ${name}`,
      status: "success",
      details: { name, permissions },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.status(201).json({
      message: "Role created successfully",
      role,
    });
  } catch (error) {
    console.error("Create role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Edit role (admin operation)
 * Cannot edit system roles
 */
export const editRole: RequestHandler = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, description, permissions } = req.body;
    const adminId = req.body.adminId || (req as any).user?.id;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Cannot edit system roles
    if (role.isSystem) {
      return res.status(403).json({ error: "Cannot edit system roles" });
    }

    const changes: any = {};

    if (name && name !== role.name) {
      // Check if new name already exists
      const existingRole = await Role.findOne({ name });
      if (existingRole) {
        return res.status(409).json({ error: "Role name already exists" });
      }
      changes.name = { from: role.name, to: name };
      role.name = name;
    }

    if (description && description !== role.description) {
      changes.description = { from: role.description, to: description };
      role.description = description;
    }

    if (Array.isArray(permissions) && permissions.length > 0) {
      if (JSON.stringify(permissions) !== JSON.stringify(role.permissions)) {
        changes.permissions = { from: role.permissions, to: permissions };
        role.permissions = permissions;
      }
    }

    await role.save();

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "role_edited",
      resourceType: "role",
      resourceId: role._id,
      clinicId: req.body.clinicId || "",
      description: `Role edited: ${role.name}`,
      status: "success",
      changes,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({
      message: "Role updated successfully",
      role,
    });
  } catch (error) {
    console.error("Edit role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Delete role (admin operation)
 * Cannot delete system roles
 */
export const deleteRole: RequestHandler = async (req, res) => {
  try {
    const { roleId } = req.params;
    const adminId = req.body.adminId || (req as any).user?.id;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Cannot delete system roles
    if (role.isSystem) {
      return res.status(403).json({ error: "Cannot delete system roles" });
    }

    // Check if any users have this role
    const userCount = await User.countDocuments({ role: role.name });
    if (userCount > 0) {
      return res.status(400).json({
        error: `Cannot delete role. ${userCount} user(s) have this role.`,
      });
    }

    const roleName = role.name;
    await Role.deleteOne({ _id: roleId });

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "role_deleted",
      resourceType: "role",
      resourceId: roleId,
      clinicId: req.body.clinicId || "",
      description: `Role deleted: ${roleName}`,
      status: "success",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Delete role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get role permissions
 */
export const getRolePermissions: RequestHandler = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    res.json({
      roleId: role._id,
      permissions: role.permissions,
      isSystem: role.isSystem,
    });
  } catch (error) {
    console.error("Get role permissions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update role permissions (admin operation)
 * Cannot edit system roles
 */
export const updateRolePermissions: RequestHandler = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body;
    const adminId = req.body.adminId || (req as any).user?.id;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: "Permissions must be an array" });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Cannot edit system roles
    if (role.isSystem) {
      return res.status(403).json({ error: "Cannot edit system role permissions" });
    }

    const oldPermissions = [...role.permissions];
    role.permissions = permissions;
    await role.save();

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "permission_assigned",
      resourceType: "role",
      resourceId: role._id,
      clinicId: req.body.clinicId || "",
      description: `Permissions updated for role: ${role.name}`,
      status: "success",
      details: {
        roleName: role.name,
        addedPermissions: permissions.filter((p) => !oldPermissions.includes(p)),
        removedPermissions: oldPermissions.filter(
          (p) => !permissions.includes(p)
        ),
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({
      message: "Permissions updated successfully",
      role,
    });
  } catch (error) {
    console.error("Update role permissions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Assign role to user (admin operation)
 */
export const assignRoleToUser: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName } = req.body;
    const adminId = req.body.adminId || (req as any).user?.id;

    if (!roleName) {
      return res.status(400).json({ error: "Role name required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify role exists
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    const oldRole = user.role;
    user.role = roleName;
    await user.save();

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "role_assigned",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: `Role assigned to ${user.name}: ${roleName}`,
      status: "success",
      targetUserId: user._id,
      details: {
        previousRole: oldRole,
        newRole: roleName,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({
      message: "Role assigned successfully",
      user,
    });
  } catch (error) {
    console.error("Assign role to user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get all available permissions
 */
export const getAvailablePermissions: RequestHandler = async (req, res) => {
  try {
    const permissions = [
      // Patient Management
      "create_patient",
      "view_patient",
      "edit_patient",
      "delete_patient",

      // Consultation
      "create_consultation",
      "view_consultation",
      "edit_consultation",
      "end_consultation",

      // Prescription
      "create_prescription",
      "view_prescription",
      "edit_prescription",

      // Billing
      "create_billing",
      "view_billing",
      "manage_billing",
      "mark_payment",

      // Follow-up
      "create_followup",
      "view_followup",
      "send_followup",

      // System
      "manage_users",
      "manage_roles",
      "view_audit_logs",
      "export_data",
    ];

    res.json({
      permissions,
      total: permissions.length,
    });
  } catch (error) {
    console.error("Get available permissions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
