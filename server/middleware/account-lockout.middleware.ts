import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";

/**
 * Middleware to check if account is locked
 * Should be applied to login routes
 */
export async function checkAccountLockout(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findOne({ contact: userId });
    if (!user) {
      // Don't reveal if user exists - return generic error
      return res.status(401).json({ error: "Invalid user ID or password" });
    }

    // Check if account is locked
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingTime = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / 1000
      );
      return res.status(423).json({
        error: `Account is locked due to too many failed login attempts. Try again in ${remainingTime} seconds.`,
        code: "ACCOUNT_LOCKED",
        lockoutUntil: user.lockoutUntil,
        remainingSeconds: remainingTime,
      });
    }

    // Auto-unlock if lockout period has expired
    if (user.lockoutUntil && user.lockoutUntil <= new Date()) {
      user.loginAttempts = 0;
      user.lockoutUntil = undefined;
      await user.save();
    }

    // Check if account is suspended
    if (user.status === "suspended") {
      return res.status(403).json({
        error: "Your account has been suspended",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    next();
  } catch (error) {
    console.error("Account lockout check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Unlock a user account (admin operation)
 */
export async function unlockUserAccount(userId: string): Promise<boolean> {
  try {
    const user = await User.findOne({ contact: userId });
    if (!user) return false;

    user.loginAttempts = 0;
    user.lockoutUntil = undefined;
    await user.save();
    return true;
  } catch (error) {
    console.error("Error unlocking account:", error);
    return false;
  }
}

/**
 * Lock a user account (admin operation)
 */
export async function lockUserAccount(userId: string): Promise<boolean> {
  try {
    const user = await User.findOne({ contact: userId });
    if (!user) return false;

    user.lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();
    return true;
  } catch (error) {
    console.error("Error locking account:", error);
    return false;
  }
}

/**
 * Get lockout status for a user
 */
export async function getAccountLockoutStatus(userId: string): Promise<{
  isLocked: boolean;
  remainingSeconds?: number;
  attempts?: number;
}> {
  try {
    const user = await User.findOne({ contact: userId });
    if (!user) {
      return { isLocked: false };
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingSeconds = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / 1000
      );
      return {
        isLocked: true,
        remainingSeconds,
        attempts: user.loginAttempts,
      };
    }

    return {
      isLocked: false,
      attempts: user.loginAttempts,
    };
  } catch (error) {
    console.error("Error getting lockout status:", error);
    return { isLocked: false };
  }
}
