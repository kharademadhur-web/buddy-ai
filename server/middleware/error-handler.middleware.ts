import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

/**
 * Global error handling middleware
 * Must be registered last in the middleware stack
 */
export function errorHandler(
  error: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  if (process.env.NODE_ENV !== "production" && stack) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, errorMessage, "\n", stack);
  } else {
    console.error(`[ERROR] ${req.method} ${req.path}:`, errorMessage);
  }

  const status =
    error instanceof AppError
      ? error.status
      : (error as ApiError).status || 500;

  const code =
    error instanceof AppError
      ? error.code
      : (error as ApiError).code || "INTERNAL_SERVER_ERROR";

  const body: {
    error: { message: string; code: string; status: number } & Record<string, unknown>;
  } = {
    error: {
      message: errorMessage,
      code,
      status,
    },
  };

  if (process.env.NODE_ENV !== "production") {
    Object.assign(body.error, {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    });
  }

  res.status(status).json(body);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const error = new Error(`Route not found: ${req.method} ${req.path}`) as ApiError;
  error.status = 404;
  error.code = "NOT_FOUND";
  next(error);
}

/**
 * Async error wrapper for route handlers
 * Catches promise rejections and passes them to error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Custom API error class
 */
export class AppError extends Error implements ApiError {
  status: number;
  code: string;

  constructor(message: string, status: number = 500, code: string = "ERROR") {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation error helper
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Unauthorized error helper
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Forbidden error helper
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Not found error helper
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error helper (for duplicate resources)
 */
export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT");
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Internal server error helper
 */
export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(message, 500, "INTERNAL_SERVER_ERROR");
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
};
