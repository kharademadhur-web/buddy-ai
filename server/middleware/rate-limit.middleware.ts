import { Request, Response, NextFunction } from "express";
import { getSupabaseClient } from "../config/supabase";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Rate limiting middleware for login attempts
 * Tracks failed login attempts per user and blocks after MAX_FAILED_ATTEMPTS
 */
export async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const supabase = getSupabaseClient();

    // Get user with lockout status
    const baseSelect = "id, login_attempts";
    const tryColumns = ["locked_until", "locked_at"] as const;
    let user: any = null;
    let error: any = null;
    let lockCol: "locked_until" | "locked_at" = "locked_at";

    for (const col of tryColumns) {
      const result = await supabase
        .from("users")
        .select(`${baseSelect}, ${col}`)
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!result.error) {
        user = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
        error = null;
        lockCol = col;
        break;
      }

      if (result.error.code === "42703") {
        // undefined_column
        continue;
      }

      error = result.error;
      break;
    }

    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("invalid api key") || msg.toLowerCase().includes("jwt")) {
        return res.status(500).json({
          error:
            "Server Supabase credentials are not configured. Set SUPABASE_SERVICE_KEY and restart the server.",
        });
      }
      if (process.env.NODE_ENV !== "production") {
        return res.status(500).json({ error: `RateLimit lookup failed: ${error.message}` });
      }
    }

    if (error || !user) {
      // Don't reveal if user exists
      return res.status(401).json({ error: "Invalid user ID or password" });
    }

    // Check if account is locked
    const lockedValue = user[lockCol];
    if (lockedValue) {
      const lockTime = new Date(lockedValue).getTime();
      const now = Date.now();
      const lockDurationMs = LOCKOUT_DURATION_MS;

      if (now - lockTime < lockDurationMs) {
        const remainingMs = lockDurationMs - (now - lockTime);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        return res.status(429).json({
          error: `Account is temporarily locked. Try again in ${remainingSeconds} seconds.`,
          retryAfter: remainingSeconds,
        });
      } else {
        // Unlock account after lockout duration
        await supabase
          .from("users")
          .update({
            [lockCol]: null,
            login_attempts: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    }

    next();
  } catch (error) {
    console.error("Rate limit middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Record failed login attempt
 */
export async function recordFailedLoginAttempt(
  user_id: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, login_attempts")
      .eq("user_id", user_id)
      .single();

    if (userError || !user) {
      return;
    }

    const newAttempts = (user.login_attempts || 0) + 1;
    const isLocked = newAttempts >= MAX_FAILED_ATTEMPTS;

    // Update user's login attempts
    await supabase
      .from("users")
      .update({
        login_attempts: newAttempts,
        locked_at: isLocked ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Log the failed attempt
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "login_failed",
      resource_type: "auth",
      resource_id: user_id,
      changes: {
        ipAddress,
        userAgent,
        attemptNumber: newAttempts,
        locked: isLocked,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error recording failed login attempt:", error);
  }
}

/**
 * Reset login attempts after successful login
 */
export async function resetLoginAttempts(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    await supabase
      .from("users")
      .update({
        login_attempts: 0,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch (error) {
    console.error("Error resetting login attempts:", error);
  }
}

/**
 * Check if user is rate limited
 */
export async function isUserRateLimited(user_id: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("locked_at")
      .eq("user_id", user_id)
      .single();

    if (error || !user) {
      return false;
    }

    if (user.locked_at) {
      const lockTime = new Date(user.locked_at).getTime();
      const now = Date.now();
      return now - lockTime < LOCKOUT_DURATION_MS;
    }

    return false;
  } catch (error) {
    console.error("Error checking rate limit:", error);
    return false;
  }
}

export default {
  rateLimit,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  isUserRateLimited,
};
