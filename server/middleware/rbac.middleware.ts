import { Request, Response, NextFunction } from "express";
import { sendJsonError } from "../lib/send-json-error";

export type UserRole =
  | "super-admin"
  | "clinic-admin"
  | "doctor"
  | "receptionist"
  | "independent";

/**
 * Middleware to enforce role-based access control (RBAC)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendJsonError(res, 401, "Authentication required", "UNAUTHORIZED");
      return;
    }

    const userRole = req.user.role as UserRole;

    if (!allowedRoles.includes(userRole)) {
      sendJsonError(
        res,
        403,
        `Access denied. Required roles: ${allowedRoles.join(", ")}.`,
        "FORBIDDEN"
      );
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user is super admin
 */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendJsonError(res, 401, "Authentication required", "UNAUTHORIZED");
    return;
  }

  if (req.user.role !== "super-admin") {
    sendJsonError(res, 403, "Super admin access required", "FORBIDDEN");
    return;
  }

  next();
}

/**
 * Middleware to check if user is admin (super-admin or clinic-admin)
 * Note: For clinic-admin, we'll use super-admin role in phase 1
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendJsonError(res, 401, "Authentication required", "UNAUTHORIZED");
    return;
  }

  const adminRoles: UserRole[] = ["super-admin", "clinic-admin"];
  if (!adminRoles.includes(req.user.role)) {
    sendJsonError(res, 403, "Admin access required", "FORBIDDEN");
    return;
  }

  next();
}

/** Super-admin or clinic-admin (scoped in route handlers). */
export function requireSuperAdminOrClinicAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendJsonError(res, 401, "Authentication required", "UNAUTHORIZED");
    return;
  }
  if (req.user.role !== "super-admin" && req.user.role !== "clinic-admin") {
    sendJsonError(res, 403, "Admin access required", "FORBIDDEN");
    return;
  }
  next();
}

/**
 * Middleware to verify clinic access
 * User must belong to the clinic they're accessing
 */
export function requireClinicAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendJsonError(res, 401, "Authentication required", "UNAUTHORIZED");
    return;
  }

  const clinicIdFromRequest = req.params.clinicId || req.body.clinic_id;

  // Super admin can access any clinic
  if (req.user.role === "super-admin") {
    next();
    return;
  }

  // Other users must have matching clinic_id
  if (req.user.clinicId !== clinicIdFromRequest) {
    sendJsonError(
      res,
      403,
      "Access denied. You don't have permission to access this clinic.",
      "FORBIDDEN"
    );
    return;
  }

  next();
}

/**
 * Middleware to allow only doctors
 */
export function requireDoctor(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendJsonError(res, 401, "Authentication required", "UNAUTHORIZED");
    return;
  }

  if (req.user.role !== "doctor") {
    sendJsonError(res, 403, "Doctor access required", "FORBIDDEN");
    return;
  }

  next();
}

/**
 * Middleware to allow doctors and receptionists
 */
export function requireClinicStaff(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    sendJsonError(res, 401, "Authentication required", "UNAUTHORIZED");
    return;
  }

  const allowedRoles = ["doctor", "receptionist"];
  if (!allowedRoles.includes(req.user.role)) {
    sendJsonError(res, 403, "Clinic staff access required", "FORBIDDEN");
    return;
  }

  next();
}

export default {
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  requireSuperAdminOrClinicAdmin,
  requireClinicAccess,
  requireDoctor,
  requireClinicStaff,
};
