import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { RefreshSession } from "../models/RefreshSession";
import { BiometricToken } from "../models/BiometricToken";
import { AuditLog } from "../models/AuditLog";
import {
  validatePassword,
  hashPassword,
  verifyPassword,
  generateTemporaryPassword,
} from "../services/password.service";
import { sendOTP, sendCredentials } from "../services/notification.service";
import {
  recordFailedLoginAttempt,
  resetLoginAttempts,
} from "../middleware/rate-limit.middleware";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";

/**
 * Hash token for secure storage
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate JWT token
 */
function generateToken(userId: string, expiresIn: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
}

/**
 * Create Super Admin user (admin operation)
 * Generates temporary OTP and credentials
 */
export const createUser: RequestHandler = async (req, res) => {
  try {
    const { name, phone, email, role, clinicId } = req.body;

    if (!name || !phone || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ contact: phone }, { contact: email }],
    });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    // Create user
    const user = new User({
      contact: phone,
      contactType: "phone",
      name,
      role,
      clinicId,
      status: "pending",
      isVerified: false,
      loginAttempts: 0,
      biometricEnabled: false,
    });

    await user.save();

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();
    user.temporaryPassword = temporaryPassword;
    await user.save();

    // Send credentials via SMS/Email/WhatsApp
    await sendCredentials(user._id.toString(), phone, temporaryPassword, "sms");

    // Log audit
    await AuditLog.create({
      userId: req.body.adminId || "system",
      action: "user_created",
      resourceType: "user",
      resourceId: user._id,
      clinicId: clinicId || "",
      description: `User created: ${name}`,
      status: "success",
      targetUserId: user._id,
      timestamp: new Date(),
    });

    res.status(201).json({
      message: "User created successfully",
      userId: user._id,
      contact: phone,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * First-time login: Verify OTP and set password
 */
export const firstLogin: RequestHandler = async (req, res) => {
  try {
    const { userId, otp, newPassword } = req.body;

    if (!userId || !otp || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: "Invalid password",
        details: passwordValidation.errors,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // In a real implementation, verify OTP here
    // For now, we'll assume OTP validation happens elsewhere
    // TODO: Implement actual OTP verification

    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    user.passwordHash = passwordHash;
    user.passwordChangedAt = new Date();
    user.temporaryPassword = undefined;
    user.status = "active";
    user.isVerified = true;
    user.verifiedAt = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id.toString(), ACCESS_TOKEN_EXPIRY);
    const refreshToken = generateToken(user._id.toString(), REFRESH_TOKEN_EXPIRY);

    // Store refresh session
    const deviceId = req.body.deviceId || "default";
    await RefreshSession.create({
      userId: user._id,
      refreshToken: hashToken(refreshToken),
      deviceId,
      deviceInfo: {
        userAgent: req.headers["user-agent"],
      },
      ipAddress: req.ip || "unknown",
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isRotated: false,
    });

    // Log audit
    await AuditLog.create({
      userId: user._id.toString(),
      action: "otp_verified",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: "User verified OTP and set password",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    // Reset login attempts
    await resetLoginAttempts(user.contact);

    res.json({
      message: "Password set successfully",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        biometricEnabled: user.biometricEnabled,
      },
    });
  } catch (error) {
    console.error("First login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Regular login with User ID and password
 */
export const login: RequestHandler = async (req, res) => {
  try {
    const { userId, password, rememberMe, deviceId } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: "User ID and password required" });
    }

    const user = await User.findOne({ contact: userId });
    if (!user || !user.passwordHash) {
      // Record failed attempt
      await recordFailedLoginAttempt(userId, req.ip || "unknown", req.headers["user-agent"] as string);
      return res.status(401).json({ error: "Invalid user ID or password" });
    }

    // Check if account is locked
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      return res.status(423).json({
        error: "Account is locked",
        lockoutUntil: user.lockoutUntil,
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      // Record failed attempt
      await recordFailedLoginAttempt(userId, req.ip || "unknown", req.headers["user-agent"] as string);
      return res.status(401).json({ error: "Invalid user ID or password" });
    }

    // Reset login attempts after successful login
    await resetLoginAttempts(userId);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id.toString(), ACCESS_TOKEN_EXPIRY);
    const refreshToken = generateToken(user._id.toString(), REFRESH_TOKEN_EXPIRY);

    // Store refresh session if remember me is enabled
    if (rememberMe) {
      const device = deviceId || "default";
      await RefreshSession.create({
        userId: user._id,
        refreshToken: hashToken(refreshToken),
        deviceId: device,
        deviceInfo: {
          userAgent: req.headers["user-agent"],
        },
        ipAddress: req.ip || "unknown",
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isRotated: false,
      });
    }

    // Log audit
    await AuditLog.create({
      userId: user._id.toString(),
      action: "login",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: "User logged in",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken: rememberMe ? refreshToken : undefined,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        biometricEnabled: user.biometricEnabled,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Refresh access token with token rotation
 */
export const refreshToken: RequestHandler = async (req, res) => {
  try {
    const { refreshToken: token, deviceId } = req.body;

    if (!token || !deviceId) {
      return res.status(400).json({ error: "Refresh token and device ID required" });
    }

    // Find refresh session
    const session = await RefreshSession.findOne({
      deviceId,
      refreshToken: hashToken(token),
    });

    if (!session) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Check if token is expired
    if (session.expiresAt < new Date()) {
      await RefreshSession.deleteOne({ _id: session._id });
      return res.status(401).json({ error: "Refresh token expired" });
    }

    // Generate new tokens
    const accessToken = generateToken(
      session.userId.toString(),
      ACCESS_TOKEN_EXPIRY
    );
    const newRefreshToken = generateToken(
      session.userId.toString(),
      REFRESH_TOKEN_EXPIRY
    );

    // Rotate refresh token: delete old session and create new one
    await RefreshSession.deleteOne({ _id: session._id });
    await RefreshSession.create({
      userId: session.userId,
      refreshToken: hashToken(newRefreshToken),
      deviceId,
      deviceInfo: session.deviceInfo,
      ipAddress: req.ip || session.ipAddress,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isRotated: true,
    });

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Logout: Invalidate refresh session
 */
export const logout: RequestHandler = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.body.userId || (req as any).user?.id;

    if (!userId || !deviceId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Delete refresh session
    await RefreshSession.deleteOne({ userId, deviceId });

    // Log audit
    await AuditLog.create({
      userId: userId.toString(),
      action: "logout",
      resourceType: "user",
      resourceId: userId,
      clinicId: req.body.clinicId || "",
      description: "User logged out",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Change password (authenticated user)
 */
export const changePassword: RequestHandler = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.body.userId || (req as any).user?.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: "Invalid password",
        details: passwordValidation.errors,
      });
    }

    const user = await User.findById(userId);
    if (!user || !user.passwordHash) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify old password
    const isOldPasswordValid = await verifyPassword(
      oldPassword,
      user.passwordHash
    );
    if (!isOldPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    user.passwordHash = passwordHash;
    user.passwordChangedAt = new Date();
    await user.save();

    // Log audit
    await AuditLog.create({
      userId: user._id.toString(),
      action: "password_change",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: "User changed password",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Request password reset (public)
 */
export const requestPasswordReset: RequestHandler = async (req, res) => {
  try {
    const { userIdOrEmail } = req.body;

    if (!userIdOrEmail) {
      return res.status(400).json({ error: "User ID or email required" });
    }

    const user = await User.findOne({
      $or: [{ contact: userIdOrEmail }],
    });

    if (!user) {
      // Don't reveal if user exists
      return res.json({
        message: "If user exists, password reset link has been sent",
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user._id, type: "password-reset" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // In production, send this token via email with reset link
    // For now, we just store it temporarily
    user.temporaryPassword = resetToken;
    await user.save();

    // Log audit
    await AuditLog.create({
      userId: user._id.toString(),
      action: "password_reset_requested",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: "User requested password reset",
      status: "success",
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    res.json({
      message: "If user exists, password reset link has been sent",
    });
  } catch (error) {
    console.error("Request password reset error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Reset password with token
 */
export const resetPassword: RequestHandler = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: "Invalid password",
        details: passwordValidation.errors,
      });
    }

    // Verify reset token
    try {
      const decoded = jwt.verify(resetToken, JWT_SECRET) as any;

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);
      user.passwordHash = passwordHash;
      user.passwordChangedAt = new Date();
      user.lastPasswordReset = new Date();
      user.temporaryPassword = undefined;
      await user.save();

      // Log audit
      await AuditLog.create({
        userId: user._id.toString(),
        action: "password_reset",
        resourceType: "user",
        resourceId: user._id,
        clinicId: user.clinicId || "",
        description: "User reset password",
        status: "success",
        timestamp: new Date(),
      });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired reset token" });
    }
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Register biometric credential
 */
export const registerBiometric: RequestHandler = async (req, res) => {
  try {
    const { credential, deviceId } = req.body;
    const userId = req.body.userId || (req as any).user?.id;

    if (!credential || !deviceId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Store biometric token
    await BiometricToken.create({
      userId,
      deviceId,
      credential,
      expiresAt: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000), // 6 months
      lastUsed: new Date(),
    });

    // Update user
    user.biometricEnabled = true;
    await user.save();

    // Log audit
    await AuditLog.create({
      userId: user._id.toString(),
      action: "biometric_registered",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: "User registered biometric",
      status: "success",
      ipAddress: req.ip,
      timestamp: new Date(),
    });

    res.json({ message: "Biometric registered successfully" });
  } catch (error) {
    console.error("Register biometric error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Login with biometric
 */
export const biometricLogin: RequestHandler = async (req, res) => {
  try {
    const { userId, credential, deviceId } = req.body;

    if (!userId || !credential || !deviceId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await User.findOne({ contact: userId });
    if (!user) {
      return res.status(401).json({ error: "Invalid user ID" });
    }

    // Verify biometric token
    const bioToken = await BiometricToken.findOne({
      userId: user._id,
      deviceId,
    });

    if (!bioToken || bioToken.credential !== credential) {
      return res.status(401).json({ error: "Invalid biometric" });
    }

    // Check if biometric token is expired
    if (bioToken.expiresAt < new Date()) {
      await BiometricToken.deleteOne({ _id: bioToken._id });
      return res.status(401).json({ error: "Biometric token expired" });
    }

    // Update last used
    bioToken.lastUsed = new Date();
    await bioToken.save();

    // Generate tokens
    const accessToken = generateToken(user._id.toString(), ACCESS_TOKEN_EXPIRY);
    const refreshToken = generateToken(user._id.toString(), REFRESH_TOKEN_EXPIRY);

    // Create refresh session
    await RefreshSession.create({
      userId: user._id,
      refreshToken: hashToken(refreshToken),
      deviceId,
      deviceInfo: {
        userAgent: req.headers["user-agent"],
      },
      ipAddress: req.ip || "unknown",
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isRotated: false,
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log audit
    await AuditLog.create({
      userId: user._id.toString(),
      action: "biometric_login",
      resourceType: "user",
      resourceId: user._id,
      clinicId: user.clinicId || "",
      description: "User logged in with biometric",
      status: "success",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date(),
    });

    res.json({
      message: "Biometric login successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Biometric login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
