import type { SupabaseClient } from "@supabase/supabase-js";

export type ClinicRow = {
  id: string;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  subscription_started_at?: string | null;
};

const STAFF_ROLES_REQUIRING_SAAS = new Set([
  "doctor",
  "receptionist",
  "clinic-admin",
  "independent",
]);

export function requiresClinicSubscriptionCheck(role: string | undefined): boolean {
  if (!role) return false;
  return STAFF_ROLES_REQUIRING_SAAS.has(role);
}

/** Deny portal login for clinic-scoped staff when SaaS is not active. */
export function getClinicLoginDenialMessage(clinic: ClinicRow | null): string | null {
  if (!clinic) {
    return "Clinic account is not available. Contact support.";
  }

  const status = (clinic.subscription_status || "").toLowerCase();
  const expiresAt = clinic.subscription_expires_at
    ? new Date(clinic.subscription_expires_at).getTime()
    : null;
  const now = Date.now();

  if (status === "suspended") {
    return "This clinic has been suspended. Contact your administrator.";
  }
  if (status === "inactive") {
    return "This clinic is inactive. Contact support.";
  }
  if (status === "payment_due") {
    return "Subscription payment is due. Please complete payment to continue.";
  }
  if (status === "pending") {
    return "Clinic subscription is not active yet. Payment must be completed before access is granted.";
  }

  if (status === "live") {
    if (expiresAt == null || Number.isNaN(expiresAt)) {
      return "Subscription period is not configured. Contact support.";
    }
    if (expiresAt < now) {
      return "Subscription has expired. Please renew your plan to continue.";
    }
    return null;
  }

  return "Subscription is not active. Contact support.";
}

/** Sync DB: live + past expiry → payment_due */
export async function syncClinicPaymentDueIfExpired(
  supabase: SupabaseClient,
  clinicId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("clinics")
    .select("id, subscription_status, subscription_expires_at")
    .eq("id", clinicId)
    .maybeSingle();

  if (!row) return;
  const st = String(row.subscription_status || "").toLowerCase();
  if (st !== "live") return;
  const exp = row.subscription_expires_at
    ? new Date(row.subscription_expires_at).getTime()
    : null;
  if (exp == null || Number.isNaN(exp)) return;
  if (exp >= Date.now()) return;

  await supabase
    .from("clinics")
    .update({
      subscription_status: "payment_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicId);
}
