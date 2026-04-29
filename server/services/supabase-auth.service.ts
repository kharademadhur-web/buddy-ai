import { getSupabaseClient } from "../config/supabase";
import { verifyPassword, hashPassword } from "../config/encryption";
import {
  generateTokens,
  verifyRefreshToken,
  JWTPayload,
} from "../config/jwt";
import DeviceApprovalService from "./device-approval.service";
import {
  requiresClinicSubscriptionCheck,
  getClinicLoginDenialMessage,
  syncClinicPaymentDueIfExpired,
} from "../lib/clinic-subscription-access";

export interface LoginRequest {
  user_id: string; // e.g., MUM001-DOC-10234
  password: string;
  deviceId?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    user_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    clinic_id: string | null;
    clinic_code?: string | null;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Authentication service using Supabase and JWT
 */
export class SupabaseAuthService {
  private static async getUserForLogin(supabase: any, user_id: string) {
    const baseSelect =
      "id, user_id, name, email, phone, role, clinic_id, password_hash, is_active, login_attempts, device_id";

    // Try locked_until first (newer schema), fall back to locked_at (older schema)
    const tryColumns = ["locked_until", "locked_at"] as const;
    for (const lockCol of tryColumns) {
      const { data, error } = await supabase
        .from("users")
        .select(`${baseSelect}, ${lockCol}`)
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error) {
        const first = Array.isArray(data) ? data[0] ?? null : data;
        return { user: first, userError: null, lockCol };
      }

      // 42703 = undefined_column
      if ((error as any).code === "42703") continue;
      return { user: null, userError: error, lockCol };
    }

    return {
      user: null,
      userError: { message: "No compatible lockout column found on users table" },
      lockCol: "locked_at" as const,
    };
  }
  /**
   * Authenticate user with user_id and password
   */
  static async login(
    request: LoginRequest
  ): Promise<{ success: boolean; data?: LoginResponse; error?: string }> {
    const supabase = getSupabaseClient();
    const { user_id, password, deviceId, clientIp, userAgent } = request;

    try {
      // Find user by user_id (supports both locked_until and locked_at schemas)
      const { user, userError, lockCol } = await this.getUserForLogin(
        supabase,
        user_id
      );

      if (userError) {
        // Distinguish config/connectivity failures from real bad credentials.
        const msg = userError.message || "";
        if (msg.toLowerCase().includes("invalid api key") || msg.toLowerCase().includes("jwt")) {
          return {
            success: false,
            error:
              "Server Supabase credentials are not configured. Set SUPABASE_SERVICE_KEY and restart the server.",
          };
        }

        // In non-production, surface the lookup error to unblock debugging.
        if (process.env.NODE_ENV !== "production") {
          return { success: false, error: `Auth lookup failed: ${userError.message}` };
        }
      }

      if (userError || !user) {
        // Log failed attempt for rate limiting
        await this.recordFailedLoginAttempt(user_id);
        return { success: false, error: "Invalid user ID or password" };
      }

      // Check if account is locked
      const lockedValue = (user as any)[lockCol];
      if (lockedValue) {
        const lockTime = new Date(lockedValue);
        const now = new Date();
        const lockDurationMs = 15 * 60 * 1000; // 15 minutes

        if (now.getTime() - lockTime.getTime() < lockDurationMs) {
          return { success: false, error: "Account is locked. Try again later." };
        } else {
          // Unlock account after 15 minutes
          await supabase
            .from("users")
            .update({ [lockCol]: null, login_attempts: 0 })
            .eq("id", user.id);
        }
      }

      // Verify password
      const passwordValid = await verifyPassword(
        password,
        user.password_hash
      );
      if (!passwordValid) {
        if (process.env.NODE_ENV !== "production") {
          return {
            success: false,
            error:
              "Invalid user ID or password",
            // debug: expose minimal info to diagnose env/schema mismatches
            // (never include the password or full hash)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...( {
              debug: {
                hashPrefix: String(user.password_hash || "").slice(0, 4),
                hashLen: String(user.password_hash || "").length,
              },
            } as any),
          };
        }

        // Record failed attempt
        const newAttempts = (user.login_attempts || 0) + 1;
        await supabase
          .from("users")
          .update({
            login_attempts: newAttempts,
            [lockCol]: newAttempts >= 5 ? new Date().toISOString() : null,
          })
          .eq("id", user.id);

        return { success: false, error: "Invalid user ID or password" };
      }

      // Check if user is active
      if (!user.is_active) {
        return { success: false, error: "User account is inactive" };
      }

      // SaaS subscription: clinic staff requires active prepaid subscription
      if (requiresClinicSubscriptionCheck(user.role)) {
        if (!user.clinic_id) {
          return {
            success: false,
            error: "Invalid account configuration. Contact support.",
          };
        }
        await syncClinicPaymentDueIfExpired(supabase, user.clinic_id);
        const { data: clinicRow } = await supabase
          .from("clinics")
          .select("id, subscription_status, subscription_expires_at, subscription_started_at")
          .eq("id", user.clinic_id)
          .maybeSingle();

        const denial = getClinicLoginDenialMessage(clinicRow as any);
        if (denial) {
          return { success: false, error: denial };
        }
      }

      if (user.role !== "super-admin" && !deviceId) {
        return {
          success: false,
          error:
            "Device identification is required. Please use a supported browser and ensure local storage is enabled.",
        };
      }

      // Device validation (if provided)
      if (deviceId) {
        // Super-admin must not be blocked by device approval; allow re-register.
        if (user.role === "super-admin") {
          // If first login or device changed, overwrite device_id and continue.
          await DeviceApprovalService.registerDevice(user.id, { deviceId });
        } else {
        const deviceValidation = await DeviceApprovalService.validateDevice(
          user.id,
          deviceId
        );

        if (!deviceValidation.valid && deviceValidation.requiresApproval) {
          const approval = await DeviceApprovalService.requestDeviceApproval(user.id, {
            deviceId,
          });
          if (approval.ok === false) {
            return { success: false, error: approval.error };
          }
          return {
            success: false,
            error:
              "Device approval required. A pending request is registered — ask your clinic or platform admin to approve this device in Device Approvals.",
          };
        }

        // If first login, register the device
        if (!user.device_id && deviceValidation.valid) {
          await DeviceApprovalService.registerDevice(user.id, {
            deviceId,
          });
        }
        }
      }

      // Clear failed login attempts
      await supabase
        .from("users")
        .update({
          login_attempts: 0,
          [lockCol]: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      let clinic_code: string | null = null;
      if (user.clinic_id) {
        const { data: clinicMeta } = await supabase
          .from("clinics")
          .select("clinic_code")
          .eq("id", user.clinic_id)
          .maybeSingle();
        clinic_code = (clinicMeta as { clinic_code?: string } | null)?.clinic_code ?? null;
      }

      // Generate JWT tokens
      const tokenPayload: JWTPayload = {
        userId: user.id,
        user_id: user.user_id,
        name: user.name,
        role: user.role,
        email: user.email || undefined,
        phone: user.phone || undefined,
        clinicId: user.clinic_id || undefined,
      };

      const tokens = generateTokens(tokenPayload);

      // Log successful login
      await this.logLoginAttempt(user.id, true, user.role, clientIp, userAgent);

      return {
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: {
            id: user.id,
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            clinic_id: user.clinic_id,
            clinic_code,
          },
        },
      };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Authentication failed" };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    refreshToken: string
  ): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        return { success: false, error: "Invalid or expired refresh token" };
      }

      // Get user to verify they still exist and are active
      const supabase = getSupabaseClient();
      const { data: user, error } = await supabase
        .from("users")
        .select("id, is_active")
        .eq("id", payload.userId)
        .single();

      if (error || !user || !user.is_active) {
        return { success: false, error: "User not found or inactive" };
      }

      // Generate new access token (keep same payload)
      const newAccessToken = generateTokens(payload).accessToken;

      return { success: true, accessToken: newAccessToken };
    } catch (error) {
      console.error("Token refresh error:", error);
      return { success: false, error: "Token refresh failed" };
    }
  }

  /**
   * Logout user (invalidate tokens)
   * Note: JWT tokens are stateless, so we just return success
   * For more security, maintain a token blacklist in the DB
   */
  static async logout(userId: string): Promise<boolean> {
    try {
      // Log logout event
      await this.logLogoutAttempt(userId);
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  }

  /**
   * Record failed login attempt for rate limiting
   */
  private static async recordFailedLoginAttempt(user_id: string): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      await supabase.from("audit_logs").insert({
        action: "login_failed",
        resource_type: "user",
        resource_id: user_id,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error recording failed login attempt:", error);
    }
  }

  /**
   * Log successful login
   */
  private static async logLoginAttempt(
    userId: string,
    success: boolean,
    userRole?: string,
    ip?: string,
    ua?: string
  ): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      await supabase.from("audit_logs").insert({
        user_id: userId,
        user_role: userRole ?? null,
        action: success ? "login_success" : "login_failed",
        resource_type: "auth",
        ip_address: ip ?? null,
        user_agent: ua ?? null,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error logging login attempt:", error);
    }
  }

  /**
   * Log logout
   */
  private static async logLogoutAttempt(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action: "logout",
        resource_type: "auth",
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error logging logout:", error);
    }
  }

  /**
   * Reset user password (admin operation)
   */
  static async resetPassword(
    userId: string,
    newPassword: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();

    try {
      const hashedPassword = await hashPassword(newPassword);

      const { error } = await supabase
        .from("users")
        .update({
          password_hash: hashedPassword,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Password reset error:", error);
      return false;
    }
  }

  /**
   * Set password after verified phone OTP (no old password).
   */
  static async setPasswordAfterOtp(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    try {
      const newPasswordHash = await hashPassword(newPassword);
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) throw updateError;
      return { success: true };
    } catch (error) {
      console.error("setPasswordAfterOtp error:", error);
      return { success: false, error: "Failed to update password" };
    }
  }

  /** Verify current password without changing it (e.g. before OTP step). */
  static async verifyCurrentPassword(
    userId: string,
    password: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", userId)
      .single();
    if (error || !user?.password_hash) return false;
    return verifyPassword(password, user.password_hash);
  }

  /**
   * Change password (user operation)
   */
  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();

    try {
      // Get user's current password hash
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return { success: false, error: "User not found" };
      }

      // Verify old password
      const oldPasswordValid = await verifyPassword(
        oldPassword,
        user.password_hash
      );
      if (!oldPasswordValid) {
        return { success: false, error: "Current password is incorrect" };
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      const { error: updateError } = await supabase
        .from("users")
        .update({
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

      return { success: true };
    } catch (error) {
      console.error("Change password error:", error);
      return { success: false, error: "Failed to change password" };
    }
  }
}

export default SupabaseAuthService;
