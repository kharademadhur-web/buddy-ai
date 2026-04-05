import { Request, Response, NextFunction } from "express";

/**
 * Structured request logging (API level). Pair with errorHandler for full traces.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  (req as Request & { logId?: string }).logId = id;

  res.on("finish", () => {
    const ms = Date.now() - start;
    const uid = (req as Request & { user?: { userId?: string } }).user?.userId || "-";
    console.log(
      `[REQ ${id}] ${req.method} ${req.originalUrl || req.path} ${res.statusCode} ${ms}ms user=${uid}`
    );
  });
  next();
}
