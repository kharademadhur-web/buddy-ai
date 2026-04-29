import { Router, Request, Response } from "express";
import SupabaseAuthService from "../services/supabase-auth.service";
import OtpAuthService, { normalizePhoneDigits } from "../services/otp-auth.service";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { rateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

/**
 * POST /api/auth/send-otp
 * Start OTP login by creating an OTP session.
 */
router.post(
  "/send-otp",
  asyncHandler(async (req: Request, res: Response) => {
    const { contact, contactType } = req.body as {
      contact?: string;
      contactType?: "phone" | "email";
    };

    if (!contact || !contactType) {
      throw new ValidationError("contact and contactType are required");
    }
    if (contactType !== "phone" && contactType !== "email") {
      throw new ValidationError("contactType must be phone or email");
    }

    const result = await OtpAuthService.sendOtp(contact, contactType);

    res.json({
      success: true,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
    });
  })
);

/**
 * POST /api/auth/verify-otp
 * Verify OTP and issue JWT tokens.
 */
router.post(
  "/verify-otp",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, otp } = req.body as { sessionId?: string; otp?: string };

    if (!sessionId || !otp) {
      throw new ValidationError("sessionId and otp are required");
    }

    const result = await OtpAuthService.verifyOtp(sessionId, otp);

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  })
);

/**
 * POST /api/auth/login
 * Login with user_id and password
 */
router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { user_id, password, deviceId } = req.body;

    // Validate input
    if (!user_id || !password) {
      throw new ValidationError("User ID and password are required");
    }

    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined;
    const userAgent = req.headers["user-agent"] || undefined;

    const result = await SupabaseAuthService.login({
      user_id,
      password,
      deviceId,
      clientIp,
      userAgent,
    });

    if (!result.success) {
      const maybeDebug = (result as { debug?: unknown }).debug;
      const msg = typeof result.error === "string" ? result.error : "Login failed";
      if (process.env.NODE_ENV !== "production" && maybeDebug) {
        return res.status(401).json({
          error: { message: msg, code: "UNAUTHORIZED", status: 401 },
          debug: maybeDebug,
        });
      }
      return sendJsonError(res, 401, msg, "UNAUTHORIZED");
    }

    res.json({
      success: true,
      data: result.data,
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError("Refresh token is required");
    }

    const result = await SupabaseAuthService.refreshAccessToken(refreshToken);

    if (!result.success) {
      const msg = typeof result.error === "string" ? result.error : "Token refresh failed";
      return sendJsonError(res, 401, msg, "UNAUTHORIZED");
    }

    res.json({
      success: true,
      accessToken: result.accessToken,
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post(
  "/logout",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ValidationError("User not found in request");
    }

    await SupabaseAuthService.logout(req.user.userId);

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  })
);

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ValidationError("User not found in request");
    }

    res.json({
      success: true,
      user: req.user,
    });
  })
);

/**
 * POST /api/auth/change-password
 * Change password (user operation)
 */
router.post(
  "/change-password",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new ValidationError("Old password and new password are required");
    }

    if (newPassword.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    if (!req.user) {
      throw new ValidationError("User not found in request");
    }

    const result = await SupabaseAuthService.changePassword(
      req.user.userId,
      oldPassword,
      newPassword
    );

    if (!result.success) {
      const msg = typeof result.error === "string" ? result.error : "Password change failed";
      return sendJsonError(res, 400, msg, "VALIDATION_ERROR");
    }

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  })
);

/**
 * POST /api/auth/password-change/request-otp
 * Body: { currentPassword: string, phone: string } — must match account phone; then OTP is sent.
 */
router.post(
  "/password-change/request-otp",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ValidationError("Unauthorized");
    }
    const { currentPassword, phone } = req.body as { currentPassword?: string; phone?: string };
    let result: { sessionId: string; expiresAt: string };
    if (currentPassword && phone) {
      result = await OtpAuthService.sendPasswordChangeOtpWithPasswordAndPhone(
        req.user.userId,
        currentPassword,
        phone
      );
    } else {
      result = await OtpAuthService.sendPasswordChangeOtpForUser(req.user.userId);
    }
    res.json({
      success: true,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
    });
  })
);

/**
 * POST /api/auth/password-change/complete
 * Verify OTP and set new password (no old password).
 */
router.post(
  "/password-change/complete",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, otp, newPassword } = req.body as {
      sessionId?: string;
      otp?: string;
      newPassword?: string;
    };

    if (!sessionId || !otp || !newPassword) {
      throw new ValidationError("sessionId, otp, and newPassword are required");
    }
    if (newPassword.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }
    if (!req.user) {
      throw new ValidationError("Unauthorized");
    }

    const session = await OtpAuthService.verifyOtpSessionCode(sessionId, otp);
    if (session.contact_type !== "phone") {
      throw new ValidationError("Invalid OTP session");
    }

    const supabase = getSupabaseClient();
    const { data: userRow } = await supabase
      .from("users")
      .select("phone")
      .eq("id", req.user.userId)
      .single();

    if (!userRow?.phone) {
      throw new ValidationError("Phone not on file");
    }

    const a = normalizePhoneDigits(session.contact);
    const b = normalizePhoneDigits(userRow.phone);
    if (a !== b) {
      throw new ValidationError("OTP does not match this account");
    }

    const result = await SupabaseAuthService.setPasswordAfterOtp(req.user.userId, newPassword);
    if (!result.success) {
      const msg = result.error || "Failed to update password";
      return sendJsonError(res, 400, msg, "VALIDATION_ERROR");
    }

    res.json({ success: true, message: "Password updated successfully" });
  })
);

export default router;
