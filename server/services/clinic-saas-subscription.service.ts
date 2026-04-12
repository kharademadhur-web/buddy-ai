import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordSaasPaymentParams = {
  clinicId: string;
  /** If null, uses clinic.saas_plan_amount_monthly or default 5999 */
  amount?: number | null;
  months: number;
  notes?: string | null;
  createdByUserId?: string | null;
  /** When true, paid_at is set to now (manual / webhook capture). When false, use paidAt */
  paidAt?: string;
};

export type RecordSaasPaymentResult = {
  clinic: Record<string, unknown>;
  period: { start: string; end: string };
};

/**
 * Inserts clinic_saas_payments row and extends clinics.subscription_expires_at.
 * Used by super-admin manual entry and verified payment webhooks.
 */
export async function recordSaasPaymentAndExtendSubscription(
  supabase: SupabaseClient,
  params: RecordSaasPaymentParams
): Promise<RecordSaasPaymentResult> {
  const { clinicId, notes, createdByUserId } = params;
  const nMonths = Math.max(1, Math.min(36, parseInt(String(params.months ?? 1), 10) || 1));

  const { data: clinic, error: cErr } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", clinicId)
    .maybeSingle();

  if (cErr || !clinic) {
    throw new Error("Clinic not found");
  }

  const amt =
    params.amount != null && !Number.isNaN(Number(params.amount))
      ? Number(params.amount)
      : Number((clinic as { saas_plan_amount_monthly?: number }).saas_plan_amount_monthly ?? 5999);

  const now = new Date();
  let periodStart = new Date(now);
  const currentEnd = (clinic as { subscription_expires_at?: string | null }).subscription_expires_at
    ? new Date((clinic as { subscription_expires_at: string }).subscription_expires_at)
    : null;
  if (currentEnd && currentEnd.getTime() > now.getTime()) {
    periodStart = currentEnd;
  }

  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + nMonths);

  const paidAtIso = params.paidAt ?? now.toISOString();

  const { error: payErr } = await supabase.from("clinic_saas_payments").insert({
    clinic_id: clinicId,
    amount: amt,
    paid_at: paidAtIso,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    status: "completed",
    notes: notes ?? null,
    created_by: createdByUserId ?? null,
  });

  if (payErr) {
    throw new Error(`Failed to record payment: ${payErr.message}`);
  }

  const patch: Record<string, unknown> = {
    subscription_status: "live",
    subscription_expires_at: periodEnd.toISOString(),
    updated_at: now.toISOString(),
  };
  if (!(clinic as { subscription_started_at?: string | null }).subscription_started_at) {
    patch.subscription_started_at = periodStart.toISOString();
  }

  const { data: updated, error: upErr } = await supabase
    .from("clinics")
    .update(patch)
    .eq("id", clinicId)
    .select()
    .single();

  if (upErr || !updated) {
    throw new Error(`Failed to update clinic: ${upErr?.message}`);
  }

  return {
    clinic: updated as Record<string, unknown>,
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
  };
}
