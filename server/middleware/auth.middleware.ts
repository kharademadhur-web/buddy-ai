import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../services/auth.service";
import { isDeviceApproved } from "../services/device-approval.service.js";

// Extend Express Request to include user data
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Verify JWT token from Authorization header
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "No token provided",
      });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Development mode: Accept dev-test-token for testing
    if (process.env.NODE_ENV !== "production" && token === "dev-test-token") {
      console.log("[DEV MODE] Using dev-test-token");
      req.user = {
        userId: "dev-user-123",
        contact: "admin@dev.local",
        role: "super-admin",
      };
      next();
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next(); // Continue even if auth fails
  }
}

/**
 * Require specific role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
      return;
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}

/**
 * Error handler for auth errors
 */
export class AuthError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function authErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * Check device approval status (optional - only validates if device info is present)
 * This middleware checks if the device is approved for the authenticated user
 */
export function checkDeviceApproval(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // For now, this is a placeholder that just continues
  // In production, you would:
  // 1. Get device ID from request (via fingerprinting library)
  // 2. Check if device is approved via isDeviceApproved()
  // 3. If not approved, return 403 with pending approval message
  next();
}
