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
import { syncClinicPaymentDueIfExpired } from "../lib/clinic-subscription-access";
import DeviceApprovalService from "../services/device-approval.service";

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
      .select(
        "id, name, clinic_code, subscription_status, subscription_expires_at, subscription_started_at, saas_plan_amount_monthly, created_at"
      );
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
 * GET /api/admin/analytics/saas-summary
 * Dashboard KPIs: clinics by status, monthly SaaS revenue (subscription payments).
 */
router.get(
  "/saas-summary",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    const scopedClinic =
      req.user?.role === "clinic-admin" ? req.user.clinicId ?? undefined : undefined;

    let liveQ = supabase.from("clinics").select("id").eq("subscription_status", "live");
    if (scopedClinic) liveQ = liveQ.eq("id", scopedClinic);
    const { data: liveRows } = await liveQ;
    for (const r of liveRows || []) {
      await syncClinicPaymentDueIfExpired(supabase, r.id);
    }

    let allQ = supabase
      .from("clinics")
      .select("id, name, clinic_code, subscription_status, subscription_expires_at, created_at");
    if (scopedClinic) allQ = allQ.eq("id", scopedClinic);
    const { data: allClinics, error: cErr } = await allQ;

    if (cErr) {
      throw new Error(`Failed to fetch clinics: ${cErr.message}`);
    }

    const list = allClinics || [];
    const now = new Date();

    const atRiskClinics = list
      .map((c: any) => {
        const nowMs = now.getTime();
        if (c.subscription_status === "payment_due") {
          return {
            id: c.id,
            name: c.name,
            clinic_code: c.clinic_code,
            subscription_status: c.subscription_status,
            subscription_expires_at: c.subscription_expires_at,
            reason: "payment_due" as const,
          };
        }
        if (c.subscription_status === "live" && c.subscription_expires_at) {
          const exp = new Date(c.subscription_expires_at).getTime();
          if (!Number.isNaN(exp) && exp < nowMs) {
            return {
              id: c.id,
              name: c.name,
              clinic_code: c.clinic_code,
              subscription_status: c.subscription_status,
              subscription_expires_at: c.subscription_expires_at,
              reason: "subscription_expired" as const,
            };
          }
        }
        return null;
      })
      .filter(Boolean);
    const totalClinics = list.length;
    const liveCount = list.filter((c: any) => {
      if (c.subscription_status !== "live") return false;
      const exp = c.subscription_expires_at ? new Date(c.subscription_expires_at).getTime() : null;
      return exp != null && !Number.isNaN(exp) && exp >= now.getTime();
    }).length;
    const suspendedCount = list.filter((c: any) => c.subscription_status === "suspended").length;
    const paymentDueCount = list.filter((c: any) => {
      if (c.subscription_status === "payment_due") return true;
      if (c.subscription_status === "live" && c.subscription_expires_at) {
        return new Date(c.subscription_expires_at).getTime() < now.getTime();
      }
      return false;
    }).length;

    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    let payQ = supabase
      .from("clinic_saas_payments")
      .select("amount, status")
      .eq("status", "completed")
      .gte("paid_at", monthStart)
      .lte("paid_at", monthEnd);
    if (scopedClinic) payQ = payQ.eq("clinic_id", scopedClinic);
    const { data: monthPayments, error: pErr } = await payQ;

    if (pErr) {
      throw new Error(`Failed to fetch SaaS payments: ${pErr.message}`);
    }

    const monthlyRevenueSaaS = (monthPayments || []).reduce(
      (sum, row: { amount?: number }) => sum + Number(row.amount ?? 0),
      0
    );

    res.json({
      success: true,
      summary: {
        totalClinics,
        liveClinics: liveCount,
        suspendedClinics: suspendedCount,
        paymentDueClinics: paymentDueCount,
        monthlyRevenueSaaS,
        month: monthKey,
      },
      atRiskClinics,
    });
  })
);

/**
 * GET /api/admin/analytics/saas-payments
 * Paginated payment history for dashboard.
 */
router.get(
  "/saas-payments",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    const limit = Math.min(100, parseInt((req.query.limit as string) || "50", 10));
    const { month, clinicId: queryClinicId } = req.query as { month?: string; clinicId?: string };
    const scopedClinic =
      req.user?.role === "clinic-admin" ? req.user.clinicId ?? undefined : undefined;
    const superAdminClinicFilter =
      req.user?.role === "super-admin" && queryClinicId && typeof queryClinicId === "string"
        ? queryClinicId
        : undefined;

    let q = supabase
      .from("clinic_saas_payments")
      .select(
        `
        id, clinic_id, amount, currency, paid_at, period_start, period_end, status, notes, created_at,
        clinics(name, clinic_code)
      `
      )
      .order("paid_at", { ascending: false })
      .limit(limit);

    if (scopedClinic) q = q.eq("clinic_id", scopedClinic);
    else if (superAdminClinicFilter) q = q.eq("clinic_id", superAdminClinicFilter);

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map((x) => parseInt(x, 10));
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      q = q.gte("paid_at", start).lte("paid_at", end);
    }

    const { data: rows, error } = await q;
    if (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    res.json({
      success: true,
      payments: rows || [],
    });
  })
);

/**
 * GET /api/admin/analytics/onboarding-clinics
 * Clinics for calendar / new onboards (created_at, pending = not yet paid).
 */
router.get(
  "/onboarding-clinics",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    const days = Math.min(90, parseInt((req.query.days as string) || "30", 10));
    const since = new Date();
    since.setDate(since.getDate() - days);
    const scopedClinic =
      req.user?.role === "clinic-admin" ? req.user.clinicId ?? undefined : undefined;

    let oq = supabase
      .from("clinics")
      .select(
        "id, name, clinic_code, created_at, subscription_status, subscription_expires_at, subscription_started_at"
      )
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });
    if (scopedClinic) oq = oq.eq("id", scopedClinic);

    const { data: clinics, error } = await oq;

    if (error) {
      throw new Error(`Failed to fetch clinics: ${error.message}`);
    }

    const pendingOnboards = (clinics || []).filter(
      (c: any) => c.subscription_status === "pending" || c.subscription_status === "payment_due"
    );

    res.json({
      success: true,
      clinics: clinics || [],
      pendingCount: pendingOnboards.length,
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

    let clinicUserIds: string[] | null = null;
    if (scoped) {
      const { data: clinicUsers } = await supabase.from("users").select("id").eq("clinic_id", scoped);
      const ids = (clinicUsers || []).map((u) => u.id);
      if (!ids.length) {
        return res.json({ success: true, requests: [], count: 0 });
      }
      clinicUserIds = ids;
    }

    const requests = await DeviceApprovalService.listDeviceRequestsWithUsers(
      "pending",
      500,
      clinicUserIds
    );

    res.json({
      success: true,
      requests,
      count: requests.length,
    });
  })
);

export default router;
