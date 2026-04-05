import { RequestHandler } from "express";
import {
  getPendingApprovals,
  approveDevice,
  rejectDevice,
  getDeviceApprovalStatus,
} from "../services/device-approval.service";

/**
 * Get all pending device approval requests
 */
export const getPendingApprovalsHandler: RequestHandler = async (req, res) => {
  try {
    const approvals = await getPendingApprovals("pending");

    res.json({
      success: true,
      data: {
        approvals,
        count: approvals.length,
      },
    });
  } catch (error) {
    console.error("Error getting pending approvals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get pending approvals",
    });
  }
};

/**
 * Approve a device for a user
 */
export const approveDeviceHandler: RequestHandler = async (req, res) => {
  try {
    const { approvalRequestId } = req.params;
    const adminId = req.user?.userId;

    if (!adminId) {
      res.status(401).json({
        success: false,
        message: "Admin ID not found",
      });
      return;
    }

    const approval = await approveDevice(approvalRequestId, adminId);

    res.json({
      success: true,
      message: "Device approved successfully",
      data: {
        approvalId: approval._id,
        userId: approval.userId,
        deviceId: approval.deviceId,
        status: approval.status,
      },
    });
  } catch (error) {
    console.error("Error approving device:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve device",
    });
  }
};

/**
 * Reject a device for a user
 */
export const rejectDeviceHandler: RequestHandler = async (req, res) => {
  try {
    const { approvalRequestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.userId;

    if (!adminId) {
      res.status(401).json({
        success: false,
        message: "Admin ID not found",
      });
      return;
    }

    if (!reason) {
      res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
      return;
    }

    const approval = await rejectDevice(approvalRequestId, adminId, reason);

    res.json({
      success: true,
      message: "Device rejected successfully",
      data: {
        approvalId: approval._id,
        userId: approval.userId,
        deviceId: approval.deviceId,
        status: approval.status,
        rejectionReason: approval.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Error rejecting device:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject device",
    });
  }
};

/**
 * Get device approval status
 */
export const getDeviceApprovalStatusHandler: RequestHandler = async (
  req,
  res
) => {
  try {
    const { userId, deviceId } = req.params;

    const status = await getDeviceApprovalStatus(userId, deviceId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting device approval status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get device approval status",
    });
  }
};
