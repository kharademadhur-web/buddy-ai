import { getSupabaseClient } from "../config/supabase";
import crypto from "crypto";

/** When `true`, first login auto-binds `users.device_id` without admin approval (legacy behavior). Default: strict first-device approval. */
function isAutoRegisterFirstDeviceEnabled(): boolean {
  return process.env.DEVICE_APPROVAL_AUTO_REGISTER_FIRST_DEVICE === "true";
}

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface DeviceApprovalRequest {
  id: string;
  user_id: string;
  /** Legacy name; DB column is `new_device_id`. */
  device_id?: string;
  new_device_id?: string;
  device_fingerprint?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  expires_at?: string;
}

export type RequestDeviceApprovalResult =
  | { ok: true; request: DeviceApprovalRequest }
  | { ok: false; error: string };

function formatDeviceApprovalDbError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: string }).message)
      : String(err);

  if (
    code === "42501" ||
    /permission denied|row-level security|RLS/i.test(message)
  ) {
    return (
      "Could not save the device approval request. Configure SUPABASE_SERVICE_KEY on the API server " +
      "(Supabase service_role key) so inserts are not blocked by Row Level Security."
    );
  }
  return message || "Failed to create device approval request";
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

    // First device for this account: require admin approval once, then this browser's id matches forever (until reset/new device).
    if (!user.device_id) {
      if (isAutoRegisterFirstDeviceEnabled()) {
        return {
          valid: true,
          requiresApproval: false,
          reason: "First login - device will be registered (DEVICE_APPROVAL_AUTO_REGISTER_FIRST_DEVICE)",
        };
      }
      return {
        valid: false,
        requiresApproval: true,
        reason: "first_device_requires_approval",
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
    // Fail-closed: an unexpected DB/RLS error must NOT silently allow the user to proceed
    // to token issuance. Treat the device as un-approved so login is blocked or the
    // approval flow is triggered, and the actual error is logged for ops.
    return {
      valid: false,
      requiresApproval: true,
      reason: "validation_error",
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
): Promise<RequestDeviceApprovalResult> {
  const supabase = getSupabaseClient();

  try {
    const { data: existingPending, error: existingErr } = await supabase
      .from("device_approval_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("new_device_id", deviceInfo.deviceId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error("Device approval request (existing lookup) error:", existingErr);
      return { ok: false, error: formatDeviceApprovalDbError(existingErr) };
    }

    if (existingPending) {
      return { ok: true, request: existingPending as DeviceApprovalRequest };
    }

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
      console.error("Device approval request (insert) error:", error);
      return {
        ok: false,
        error: formatDeviceApprovalDbError(error || new Error("insert failed")),
      };
    }

    await logDeviceAction(userId, deviceInfo.deviceId, "approval_requested");

    return { ok: true, request: data as DeviceApprovalRequest };
  } catch (error) {
    console.error("Device approval request error:", error);
    return { ok: false, error: formatDeviceApprovalDbError(error) };
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

/** Row for admin UIs: request + joined user (two-query merge, avoids PostgREST embed issues). */
export type DeviceRequestWithUserRow = {
  id: string;
  user_id: string;
  new_device_id: string;
  status: string;
  created_at: string;
  users: {
    id: string;
    user_id: string;
    name: string;
    phone: string | null;
    clinic_id: string | null;
    email: string | null;
  } | null;
};

export async function listDeviceRequestsWithUsers(
  status: string,
  limit: number,
  clinicUserIds: string[] | null
): Promise<DeviceRequestWithUserRow[]> {
  const supabase = getSupabaseClient();

  let q = supabase
    .from("device_approval_requests")
    .select("id, user_id, new_device_id, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clinicUserIds !== null) {
    if (clinicUserIds.length === 0) return [];
    q = q.in("user_id", clinicUserIds);
  }

  const { data: requests, error } = await q;
  if (error) {
    throw new Error(`Failed to fetch device requests: ${error.message}`);
  }
  if (!requests?.length) return [];

  const userIds = [...new Set(requests.map((r) => r.user_id))];
  const { data: userRows, error: uerr } = await supabase
    .from("users")
    .select("id, user_id, name, phone, clinic_id, email")
    .in("id", userIds);

  if (uerr) {
    throw new Error(`Failed to load users for device requests: ${uerr.message}`);
  }

  const byId = new Map((userRows || []).map((u) => [u.id, u]));
  return requests.map((r) => ({
    ...r,
    users: byId.get(r.user_id) ?? null,
  }));
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
  listDeviceRequestsWithUsers,
  isDeviceApproved,
};

export default DeviceApprovalService;
