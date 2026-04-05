import { getSupabaseClient } from "../config/supabase";

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "bill_paid"
  | "bill_created"
  | "onboarding_step"
  | string;

/**
 * Best-effort audit row (never throws to callers).
 */
export async function writeAuditLog(params: {
  action: AuditAction;
  userId?: string | null;
  userRole?: string | null;
  resourceType?: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  status?: "success" | "failure";
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("audit_logs").insert({
      action: params.action,
      user_id: params.userId ?? null,
      user_role: params.userRole ?? null,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      changes: params.changes ?? null,
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
      status: params.status ?? "success",
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[audit] insert failed:", e instanceof Error ? e.message : e);
  }
}
