import { getSupabaseClient } from "../config/supabase";
import crypto from "crypto";

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface DeviceApprovalRequest {
  id: string;
  user_id: string;
  device_id: string;
  device_fingerprint?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  expires_at: string;
}

/**
 * Validate if a device is approved for a user
 */
export async function validateDevice(
  userId: string,
  deviceId: string
): Promise<{ valid: boolean; requiresApproval: boolean; reason?: string }> {
  const supabase = getSupabaseClient();

  try {
    // Get user's stored device
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("device_id")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return {
        valid: false,
        requiresApproval: true,
        reason: "User not found",
      };
    }

    // First login - no device stored yet
    if (!user.device_id) {
      return {
        valid: true,
        requiresApproval: false,
        reason: "First login - device will be registered",
      };
    }

    // Device matches - approved
    if (user.device_id === deviceId) {
      return {
        valid: true,
        requiresApproval: false,
        reason: "Device approved",
      };
    }

    // Device mismatch - requires approval
    return {
      valid: false,
      requiresApproval: true,
      reason: "Device not registered or not approved",
    };
  } catch (error) {
    console.error("Device validation error:", error);
    return {
      valid: false,
      requiresApproval: false,
      reason: "Validation error",
    };
  }
}

/**
 * Register a new device for a user (first login)
 */
export async function registerDevice(
  userId: string,
  deviceInfo: DeviceInfo
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from("users")
      .update({
        device_id: deviceInfo.deviceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    // Log the device registration
    await logDeviceAction(userId, deviceInfo.deviceId, "registered");

    return true;
  } catch (error) {
    console.error("Device registration error:", error);
    return false;
  }
}

/**
 * Request approval for a new device
 */
export async function requestDeviceApproval(
  userId: string,
  deviceInfo: DeviceInfo
): Promise<DeviceApprovalRequest | null> {
  const supabase = getSupabaseClient();

  try {
    const fingerprint = generateDeviceFingerprint(deviceInfo);

    const { data, error } = await supabase
      .from("device_approval_requests")
      .insert({
        user_id: userId,
        new_device_id: deviceInfo.deviceId,
        status: "pending",
      })
      .select()
      .single();

    if (error || !data) {
      throw error || new Error("Failed to create approval request");
    }

    // Log the request
    await logDeviceAction(userId, deviceInfo.deviceId, "approval_requested");

    return data as DeviceApprovalRequest;
  } catch (error) {
    console.error("Device approval request error:", error);
    return null;
  }
}

/**
 * Approve a device (admin operation)
 */
export async function approveDevice(
  requestId: string,
  approvedBy?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from("device_approval_requests")
      .select("user_id, new_device_id")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      throw fetchError || new Error("Request not found");
    }

    // Update request status
    const { error: updateError } = await supabase
      .from("device_approval_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      throw updateError;
    }

    // Register the device for the user
    const { error: deviceError } = await supabase
      .from("users")
      .update({
        device_id: request.new_device_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.user_id);

    if (deviceError) {
      throw deviceError;
    }

    // Log the approval
    await logDeviceAction(
      request.user_id,
      request.new_device_id,
      "approved",
      approvedBy
    );

    return true;
  } catch (error) {
    console.error("Device approval error:", error);
    return false;
  }
}

/**
 * Reject a device approval request
 */
export async function rejectDevice(requestId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from("device_approval_requests")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Device rejection error:", error);
    return false;
  }
}

/**
 * Get device approval status
 */
export async function getDeviceApprovalStatus(
  userId: string,
  deviceId: string
): Promise<{ status: string; isPending: boolean }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("device_approval_requests")
      .select("status")
      .eq("user_id", userId)
      .eq("new_device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return { status: "no_request", isPending: false };
    }

    return {
      status: data.status,
      isPending: data.status === "pending",
    };
  } catch (error) {
    console.error("Error fetching device approval status:", error);
    return { status: "error", isPending: false };
  }
}

/**
 * Reset device for a user (admin operation)
 */
export async function resetDevice(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from("users")
      .update({
        device_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    // Log the reset
    await logDeviceAction(userId, "unknown", "reset");

    return true;
  } catch (error) {
    console.error("Device reset error:", error);
    return false;
  }
}

/**
 * Clean up expired pending device approval requests
 */
export async function cleanupExpiredRequests(): Promise<number> {
  const supabase = getSupabaseClient();
  try {
    const now = new Date().toISOString();
    const { error, count } = await supabase
      .from("device_approval_requests")
      .delete({ count: "exact" })
      .lt("expires_at", now)
      .eq("status", "pending");

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error("Cleanup expired requests error:", error);
    return 0;
  }
}

/**
 * Get pending device approval requests for a clinic
 */
export async function getPendingApprovals(
  status: "pending" | "approved" | "rejected" = "pending"
): Promise<DeviceApprovalRequest[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from("device_approval_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as DeviceApprovalRequest[];
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    return [];
  }
}

/**
 * Check if device is approved
 */
export async function isDeviceApproved(
  userId: string,
  deviceId: string
): Promise<boolean> {
  const validation = await validateDevice(userId, deviceId);
  return validation.valid && !validation.requiresApproval;
}

/**
 * Generate a device fingerprint
 */
function generateDeviceFingerprint(deviceInfo: DeviceInfo): string {
  const data = `${deviceInfo.deviceId}${deviceInfo.userAgent || ""}${
    deviceInfo.ipAddress || ""
  }`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Log device-related actions for audit trail
 */
async function logDeviceAction(
  userId: string,
  deviceId: string,
  action: "registered" | "approved" | "rejected" | "reset" | "approval_requested",
  details?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: `device_${action}`,
      resource_type: "device",
      resource_id: deviceId,
      changes: { details },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error logging device action:", error);
  }
}

const DeviceApprovalService = {
  validateDevice,
  registerDevice,
  requestDeviceApproval,
  approveDevice,
  rejectDevice,
  getDeviceApprovalStatus,
  resetDevice,
  cleanupExpiredRequests,
  getPendingApprovals,
  isDeviceApproved,
};

export default DeviceApprovalService;
