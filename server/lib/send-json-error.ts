import type { Response } from "express";

/**
 * Consistent API error body for middleware and route handlers (matches global errorHandler).
 */
export function sendJsonError(
  res: Response,
  status: number,
  message: string,
  code: string
): Response {
  return res.status(status).json({
    error: { message, code, status },
  });
}
