import { RequestHandler } from "express";
import { User } from "../models/User";
import { RefreshSession } from "../models/RefreshSession";
import { BiometricToken } from "../models/BiometricToken";
import { AuditLog } from "../models/AuditLog";
import { hashPassword } from "../services/password.service";
import { sendCredentials } from "../services/notification.service";
import {
  lockUserAccount,
  unlockUserAccount,
  getAccountLockoutStatus,
} from "../middleware/account-lockout.middleware";

/**
 * Get all users with pagination
 */
export const getUsers: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
      ];
    }
    if (role) {
      filter.role = role;
    }
    if (status) {
      filter.status = status;
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select("-passwordHash -temporaryPassword")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.json({
      data: users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get single user details
 */
export const getUser: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      "-passwordHash -temporaryPassword"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get account lockout status
    const lockoutStatus = await getAccountLockoutStatus(user.contact);

    // Get active sessions
    const sessions = await RefreshSession.find({ userId })
      .select("-refreshToken")
      .sort({ lastUsedAt: -1 });

    // Get biometric tokens
    const biometricTokens = await BiometricToken.find({ userId }).select(
      "-credential"
    );

    res.json({
      user: {
        ...user.toObject(),
        lockoutStatus,
        activeSessions: sessions,
        biometricTokens,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Edit user details (admin operation)
 */
export const editUser: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, status, clinicId } = req.body;
    const adminId = req.body.adminId || (req as any).user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const changes: any = {};

    if (name && name !== user.name) {
      changes.name = { from: user.name, to: name };
      user.name = name;
    }

    if (role && role !== user.role) {
      changes.role = { from: user.role, to: role };
      user.role = role;
    }

    if (status && status !== user.status) {
      changes.status = { from: user.status, to: status };
      user.status = status;
    }

    if (clinicId && clinicId !== user.clinicId) {
      changes.clinicId = { from: user.clinicId, to: clinicId };
      user.clinicId = clinicId;
    }

    await user.save();

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "user_edited",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: `User edited: ${user.name}`,
      status: "success",
      targetUserId: user._id,
      changes,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({
      message: "User updated successfully",
      user: user.toObject(),
    });
  } catch (error) {
    console.error("Edit user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Force password reset (admin operation)
 * Generates new temporary password and sends to user
 */
export const forcePasswordReset: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.body.adminId || (req as any).user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate new temporary password
    const tempPassword = Math.random().toString(36).slice(2, 10).toUpperCase();
    user.passwordHash = undefined;
    user.temporaryPassword = tempPassword;
    user.status = "pending";
    await user.save();

    // Send new credentials
    await sendCredentials(user._id.toString(), user.contact, tempPassword, "sms");

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "password_reset",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: `Password reset by admin for: ${user.name}`,
      status: "success",
      targetUserId: user._id,
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    res.json({
      message: "Password reset successfully. New credentials sent to user.",
    });
  } catch (error) {
    console.error("Force password reset error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Lock user account (admin operation)
 */
export const lockAccount: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.body.adminId || (req as any).user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const success = await lockUserAccount(user.contact);
    if (!success) {
      return res.status(500).json({ error: "Failed to lock account" });
    }

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "account_locked",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: `Account locked for: ${user.name}`,
      status: "success",
      targetUserId: user._id,
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    res.json({ message: "Account locked successfully" });
  } catch (error) {
    console.error("Lock account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Unlock user account (admin operation)
 */
export const unlockAccount: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.body.adminId || (req as any).user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const success = await unlockUserAccount(user.contact);
    if (!success) {
      return res.status(500).json({ error: "Failed to unlock account" });
    }

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "account_unlocked",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: `Account unlocked for: ${user.name}`,
      status: "success",
      targetUserId: user._id,
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    res.json({ message: "Account unlocked successfully" });
  } catch (error) {
    console.error("Unlock account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Deactivate user (admin operation)
 */
export const deactivateUser: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.body.adminId || (req as any).user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.status = "suspended";
    await user.save();

    // Invalidate all refresh sessions
    await RefreshSession.deleteMany({ userId });

    // Log audit
    await AuditLog.create({
      userId: adminId,
      action: "user_deactivated",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: `User deactivated: ${user.name}`,
      status: "success",
      targetUserId: user._id,
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    res.json({ message: "User deactivated successfully" });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get user audit logs
 */
export const getUserAuditLogs: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const total = await AuditLog.countDocuments({
      $or: [{ userId }, { targetUserId: userId }],
    });

    const logs = await AuditLog.find({
      $or: [{ userId }, { targetUserId: userId }],
    })
      .skip(skip)
      .limit(Number(limit))
      .sort({ timestamp: -1 });

    res.json({
      data: logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Get user audit logs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get user sessions (active devices)
 */
export const getUserSessions: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const sessions = await RefreshSession.find({ userId })
      .select("-refreshToken")
      .sort({ lastUsedAt: -1 });

    res.json({
      data: sessions,
    });
  } catch (error) {
    console.error("Get user sessions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Sign out user from specific device
 */
export const signOutFromDevice: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID required" });
    }

    const session = await RefreshSession.findOneAndDelete({
      userId,
      deviceId,
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ message: "Signed out from device successfully" });
  } catch (error) {
    console.error("Sign out from device error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Sign out user from all devices
 */
export const signOutFromAllDevices: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    await RefreshSession.deleteMany({ userId });

    res.json({ message: "Signed out from all devices successfully" });
  } catch (error) {
    console.error("Sign out from all devices error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
