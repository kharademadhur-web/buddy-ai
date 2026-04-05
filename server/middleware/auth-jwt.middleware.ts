import { Request, Response, NextFunction } from "express";
import {
  extractTokenFromHeader,
  verifyAccessToken,
  JWTPayload,
} from "../config/jwt";
import { sendJsonError } from "../lib/send-json-error";

/**
 * Extend Express Request to include user payload
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Middleware to verify JWT token
 * Extracts token from Authorization header and verifies it
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      sendJsonError(res, 401, "Missing or invalid authorization header", "UNAUTHORIZED");
      return;
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      sendJsonError(res, 401, "Invalid or expired token", "UNAUTHORIZED");
      return;
    }

    // Attach user payload to request
    req.user = payload;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    sendJsonError(res, 401, "Authentication failed", "UNAUTHORIZED");
  }
}

/**
 * Optional auth middleware - doesn't fail if token is missing
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    // Continue without user - token was invalid but optional
    next();
  }
}

export default authMiddleware;
