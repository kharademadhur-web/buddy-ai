import React, { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

interface AdminProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string[];
  redirectTo?: string;
}

/**
 * AdminProtectedRoute component
 * For admin panel routes - uses AdminAuthContext
 * Redirects to /admin/login if not authenticated
 */
export function AdminProtectedRoute({
  children,
  requiredRole,
  redirectTo = "/admin/login",
}: AdminProtectedRouteProps) {
  const { user, isAuthenticated } = useAdminAuth();
  const location = useLocation();

  // Not authenticated - redirect to admin login
  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check required role
  if (requiredRole && requiredRole.length > 0) {
    if (!user.role || !requiredRole.includes(user.role)) {
      // Don't allow role escalation via URL typing.
      return <Navigate to={redirectTo} replace />;
    }
  }

  // Authenticated and authorized
  return <>{children}</>;
}

/**
 * Hook to check if admin user has specific role
 */
export function useAdminHasRole(role: string | string[]): boolean {
  const { user } = useAdminAuth();
  if (!user) return false;

  const rolesToCheck = Array.isArray(role) ? role : [role];
  return rolesToCheck.includes(user.role);
}

/**
 * Hook to check if user is super-admin
 */
export function useIsSuperAdmin(): boolean {
  const { user } = useAdminAuth();
  return user?.role === "super-admin";
}
