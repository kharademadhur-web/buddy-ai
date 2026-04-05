import { Router, Request, Response } from "express";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error-handler.middleware";
import {
  aggregateBillsRevenue,
  aggregateBillsTrends,
  clinicBillStats,
} from "../services/bill-analytics.service";

const router = Router();

/** Super-admin may pass ?clinicId=; clinic-admin is always scoped to their clinic. */
function effectiveClinicFilter(req: Request, queryClinicId?: string): string | undefined {
  if (req.user?.role === "clinic-admin") return req.user.clinicId ?? undefined;
  return queryClinicId;
}

/**
 * GET /api/admin/analytics/revenue
 * Revenue from `bills` (same source as clinic billing / pay flow).
 */
router.get(
  "/revenue",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const scoped = effectiveClinicFilter(req, req.query.clinicId as string | undefined);
    const supabase = getSupabaseClient();
    const { aggregate, error } = await aggregateBillsRevenue(supabase, scoped);
    if (error) throw new Error(`Failed to fetch revenue data: ${error}`);

    res.json({
      success: true,
      revenue: {
        totalRevenue: aggregate.totalRevenue,
        paidRevenue: aggregate.paidRevenue,
        pendingRevenue: aggregate.pendingRevenue,
        failedRevenue: aggregate.failedRevenue,
        cancelledRevenue: aggregate.cancelledRevenue,
        totalTransactions: aggregate.totalTransactions,
      },
    });
  })
);

/**
 * GET /api/admin/analytics/trends
 */
router.get(
  "/trends",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { months = 6 } = req.query;
    const scoped = effectiveClinicFilter(req, req.query.clinicId as string | undefined);
    const supabase = getSupabaseClient();
    const { trends, error } = await aggregateBillsTrends(
      supabase,
      parseInt(months as string, 10) || 6,
      scoped
    );
    if (error) throw new Error(`Failed to fetch trend data: ${error}`);

    res.json({
      success: true,
      trends,
    });
  })
);

/**
 * GET /api/admin/analytics/clinics
 */
router.get(
  "/clinics",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    const scoped = effectiveClinicFilter(req, undefined);

    let clinicsQuery = supabase
      .from("clinics")
      .select("id, name, clinic_code, subscription_status");
    if (scoped) clinicsQuery = clinicsQuery.eq("id", scoped);

    const { data: clinics, error: clinicsError } = await clinicsQuery;
    if (clinicsError) {
      throw new Error(`Failed to fetch clinics: ${clinicsError.message}`);
    }

    const clinicStats = await Promise.all(
      (clinics || []).map(async (clinic) => {
        const { data: users } = await supabase
          .from("users")
          .select("id, role")
          .eq("clinic_id", clinic.id);

        const stats = await clinicBillStats(supabase, clinic.id);

        return {
          clinic_id: clinic.id,
          name: clinic.name,
          code: clinic.clinic_code,
          status: clinic.subscription_status,
          totalUsers: users?.length || 0,
          doctors: users?.filter((u) => u.role === "doctor").length || 0,
          receptionists: users?.filter((u) => u.role === "receptionist").length || 0,
          totalRevenue: stats.totalRevenue,
          paidRevenue: stats.paidRevenue,
          pendingRevenue: stats.pendingRevenue,
        };
      })
    );

    res.json({
      success: true,
      clinics: clinicStats,
    });
  })
);

/**
 * GET /api/admin/analytics/users
 */
router.get(
  "/users",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    const scoped = effectiveClinicFilter(req, undefined);
    let uq = supabase.from("users").select("role, is_active");
    if (scoped) uq = uq.eq("clinic_id", scoped);
    const { data: users, error } = await uq;

    if (error) {
      throw new Error(`Failed to fetch user stats: ${error.message}`);
    }

    const stats = {
      totalUsers: users?.length || 0,
      activeUsers: users?.filter((u) => u.is_active).length || 0,
      inactiveUsers: users?.filter((u) => !u.is_active).length || 0,
      doctors: users?.filter((u) => u.role === "doctor").length || 0,
      receptionists: users?.filter((u) => u.role === "receptionist").length || 0,
      independentDoctors: users?.filter((u) => u.role === "independent").length || 0,
      superAdmins: users?.filter((u) => u.role === "super-admin").length || 0,
    };

    res.json({
      success: true,
      stats,
    });
  })
);

/**
 * GET /api/admin/analytics/audit-logs
 */
router.get(
  "/audit-logs",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { action, limit = 50, days = 7 } = req.query;

    const supabase = getSupabaseClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string, 10));

    let query = supabase
      .from("audit_logs")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(parseInt(limit as string, 10));

    if (action) {
      query = query.eq("action", action as string);
    }

    const scoped = effectiveClinicFilter(req, undefined);
    if (scoped) {
      const { data: clinicUsers } = await supabase
        .from("users")
        .select("id")
        .eq("clinic_id", scoped);
      const ids = (clinicUsers || []).map((u) => u.id);
      if (ids.length) query = query.in("user_id", ids);
      else {
        return res.json({ success: true, logs: [], count: 0 });
      }
    }

    const { data: logs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    res.json({
      success: true,
      logs: logs || [],
      count: logs?.length || 0,
    });
  })
);

/**
 * GET /api/admin/analytics/device-approvals
 */
router.get(
  "/device-approvals",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();

    const scoped = effectiveClinicFilter(req, undefined);
    let dq = supabase
      .from("device_approval_requests")
      .select(
        `
        id, user_id, new_device_id, status, created_at,
        users(user_id, name, phone, clinic_id)
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (scoped) {
      const { data: clinicUsers } = await supabase.from("users").select("id").eq("clinic_id", scoped);
      const ids = (clinicUsers || []).map((u) => u.id);
      if (ids.length) dq = dq.in("user_id", ids);
      else {
        return res.json({ success: true, requests: [], count: 0 });
      }
    }

    const { data: requests, error } = await dq;

    if (error) {
      throw new Error(`Failed to fetch device requests: ${error.message}`);
    }

    res.json({
      success: true,
      requests: requests || [],
      count: requests?.length || 0,
    });
  })
);

export default router;
