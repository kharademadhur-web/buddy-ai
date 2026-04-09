import { Router, Request, Response } from "express";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireAdmin, requireSuperAdmin } from "../middleware/rbac.middleware";
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "../middleware/error-handler.middleware";
import DeviceApprovalService from "../services/device-approval.service";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

async function assertCanManageDeviceRequest(req: import("express").Request, targetUserId: string) {
  if (req.user?.role === "super-admin") return;
  if (req.user?.role !== "clinic-admin" || !req.user.clinicId) {
    throw new ForbiddenError("Access denied");
  }
  const supabase = getSupabaseClient();
  const { data: u } = await supabase.from("users").select("clinic_id").eq("id", targetUserId).single();
  if (!u || u.clinic_id !== req.user.clinicId) {
    throw new ForbiddenError("Access denied");
  }
}

/**
 * GET /api/admin/device-approval/pending
 * Get all pending device approval requests
 */
router.get(
  "/pending",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.query;

    const supabase = getSupabaseClient();

    let query = supabase
      .from("device_approval_requests")
      .select(
        `
        id, user_id, new_device_id, status, 
        created_at,
        users(id, user_id, name, phone, clinic_id, email)
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const effectiveClinic =
      req.user?.role === "clinic-admin" ? req.user.clinicId : (clinicId as string | undefined);
    if (effectiveClinic) {
      const { data: clinicUsers } = await supabase.from("users").select("id").eq("clinic_id", effectiveClinic);
      const ids = (clinicUsers || []).map((u) => u.id);
      if (ids.length) query = query.in("user_id", ids);
      else {
        return res.json({ success: true, requests: [], count: 0 });
      }
    }

    const { data: requests, error } = await query;

    if (error) {
      throw new Error(
        `Failed to fetch pending requests: ${error.message}`
      );
    }

    res.json({
      success: true,
      requests: requests || [],
      count: requests?.length || 0,
    });
  })
);

/**
 * GET /api/admin/device-approval/requests
 * Get device approval requests with filters
 */
router.get(
  "/requests",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { status = "pending", limit = 50 } = req.query;

    const supabase = getSupabaseClient();

    let rq = supabase
      .from("device_approval_requests")
      .select(
        `
        id, user_id, new_device_id, status, 
        created_at,
        users(user_id, name, phone, clinic_id)
      `
      )
      .eq("status", status as string)
      .order("created_at", { ascending: false })
      .limit(parseInt(limit as string));

    if (req.user?.role === "clinic-admin" && req.user.clinicId) {
      const { data: clinicUsers } = await supabase.from("users").select("id").eq("clinic_id", req.user.clinicId);
      const ids = (clinicUsers || []).map((u) => u.id);
      if (ids.length) rq = rq.in("user_id", ids);
      else {
        return res.json({ success: true, requests: [], count: 0 });
      }
    }

    const { data: requests, error } = await rq;

    if (error) {
      throw new Error(
        `Failed to fetch requests: ${error.message}`
      );
    }

    res.json({
      success: true,
      requests: requests || [],
      count: requests?.length || 0,
    });
  })
);

/**
 * POST /api/admin/device-approval/:requestId/approve
 * Approve a device approval request
 */
router.post(
  "/:requestId/approve",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;

    if (!req.user) {
      throw new ValidationError("User not found in request");
    }

    const supabase = getSupabaseClient();
    const { data: row } = await supabase
      .from("device_approval_requests")
      .select("user_id")
      .eq("id", requestId)
      .single();
    if (!row) throw new NotFoundError("Request not found");
    await assertCanManageDeviceRequest(req, row.user_id);

    const success = await DeviceApprovalService.approveDevice(
      requestId,
      req.user.userId
    );

    if (!success) {
      return sendJsonError(res, 400, "Failed to approve device", "VALIDATION_ERROR");
    }

    res.json({
      success: true,
      message: "Device approved successfully",
    });
  })
);

/**
 * POST /api/admin/device-approval/:requestId/reject
 * Reject a device approval request
 */
router.post(
  "/:requestId/reject",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;

    const supabase = getSupabaseClient();
    const { data: row } = await supabase
      .from("device_approval_requests")
      .select("user_id")
      .eq("id", requestId)
      .single();
    if (!row) throw new NotFoundError("Request not found");
    await assertCanManageDeviceRequest(req, row.user_id);

    const success = await DeviceApprovalService.rejectDevice(requestId);

    if (!success) {
      return sendJsonError(res, 400, "Failed to reject device", "VALIDATION_ERROR");
    }

    res.json({
      success: true,
      message: "Device rejected successfully",
    });
  })
);

/**
 * POST /api/admin/device-approval/cleanup
 * Clean up expired device approval requests (cron job)
 */
router.post(
  "/cleanup",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const count = await DeviceApprovalService.cleanupExpiredRequests();

    res.json({
      success: true,
      message: `Cleaned up ${count} expired requests`,
      count,
    });
  })
);

/**
 * GET /api/admin/device-approval/:userId/request-status
 * Get device approval request status for a user
 */
router.get(
  "/:userId/request-status",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    if (!req.user) throw new ForbiddenError("Access denied");
    const isSelf = req.user.userId === userId;
    const isAdmin = req.user.role === "super-admin" || req.user.role === "clinic-admin";
    if (!isSelf && !isAdmin) {
      throw new ForbiddenError("Access denied");
    }

    if (req.user.role === "clinic-admin") {
      await assertCanManageDeviceRequest(req, userId);
    }

    const supabase = getSupabaseClient();

    const { data: request, error } = await supabase
      .from("device_approval_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error?.code === "PGRST116") {
      // No pending request
      return res.json({
        success: true,
        request: null,
        hasPendingRequest: false,
      });
    }

    if (error) {
      throw new Error(`Failed to fetch request status: ${error.message}`);
    }

    res.json({
      success: true,
      request,
      hasPendingRequest: !!request,
    });
  })
);

export default router;
