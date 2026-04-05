function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface BillRevenueAggregate {
  totalRevenue: string;
  paidRevenue: string;
  pendingRevenue: string;
  failedRevenue: string;
  cancelledRevenue: string;
  totalTransactions: number;
}

/**
 * Single source of truth for admin revenue: `bills` table (matches reception billing flow).
 */
export async function aggregateBillsRevenue(
  supabase: { from: (t: string) => any },
  clinicId?: string
): Promise<{ aggregate: BillRevenueAggregate; error?: string }> {
  let q = supabase.from("bills").select("total_amount, payment_status");
  if (clinicId) q = q.eq("clinic_id", clinicId);
  const { data: bills, error } = await q;
  if (error) return { aggregate: emptyAgg(), error: error.message };

  const rows = bills || [];
  let paid = 0;
  let pending = 0;
  let failed = 0;
  let cancelled = 0;
  for (const b of rows) {
    const amt = num(b.total_amount);
    const st = String(b.payment_status || "").toLowerCase();
    if (st === "paid") paid += amt;
    else if (st === "pending") pending += amt;
    else if (st === "failed") failed += amt;
    else if (st === "cancelled") cancelled += amt;
    else pending += amt;
  }
  const total = paid + pending + failed + cancelled;
  return {
    aggregate: {
      totalRevenue: total.toFixed(2),
      paidRevenue: paid.toFixed(2),
      pendingRevenue: pending.toFixed(2),
      failedRevenue: failed.toFixed(2),
      cancelledRevenue: cancelled.toFixed(2),
      totalTransactions: rows.length,
    },
  };
}

function emptyAgg(): BillRevenueAggregate {
  return {
    totalRevenue: "0.00",
    paidRevenue: "0.00",
    pendingRevenue: "0.00",
    failedRevenue: "0.00",
    cancelledRevenue: "0.00",
    totalTransactions: 0,
  };
}

export interface TrendMonth {
  month: string;
  paid: number;
  pending: number;
  failed: number;
  total: number;
}

export async function aggregateBillsTrends(
  supabase: { from: (t: string) => any },
  months: number,
  clinicId?: string
): Promise<{ trends: TrendMonth[]; error?: string }> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  let q = supabase
    .from("bills")
    .select("total_amount, payment_status, paid_at, created_at, updated_at")
    .gte("created_at", startDate.toISOString());
  if (clinicId) q = q.eq("clinic_id", clinicId);
  const { data: bills, error } = await q;
  if (error) return { trends: [], error: error.message };

  const trends: Record<string, { paid: number; pending: number; failed: number; total: number }> =
    {};

  for (const b of bills || []) {
    const amt = num(b.total_amount);
    const st = String(b.payment_status || "").toLowerCase();
    const dateStr =
      st === "paid" && b.paid_at
        ? b.paid_at
        : (b as { created_at?: string }).created_at || new Date().toISOString();
    const date = new Date(dateStr);
    const monthKey = date.toISOString().slice(0, 7);
    if (!trends[monthKey]) {
      trends[monthKey] = { paid: 0, pending: 0, failed: 0, total: 0 };
    }
    if (st === "paid") trends[monthKey].paid += amt;
    else if (st === "pending") trends[monthKey].pending += amt;
    else if (st === "failed") trends[monthKey].failed += amt;
    else trends[monthKey].pending += amt;
    trends[monthKey].total += amt;
  }

  const trendArray = Object.entries(trends)
    .map(([month, data]) => ({
      month,
      paid: parseFloat(data.paid.toFixed(2)),
      pending: parseFloat(data.pending.toFixed(2)),
      failed: parseFloat(data.failed.toFixed(2)),
      total: parseFloat(data.total.toFixed(2)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { trends: trendArray };
}

export async function clinicBillStats(
  supabase: { from: (t: string) => any },
  clinicId: string
): Promise<{
  totalRevenue: string;
  paidRevenue: string;
  pendingRevenue: string;
}> {
  const { data: bills } = await supabase
    .from("bills")
    .select("total_amount, payment_status")
    .eq("clinic_id", clinicId);

  let paid = 0;
  let total = 0;
  for (const b of bills || []) {
    const amt = num(b.total_amount);
    total += amt;
    if (String(b.payment_status).toLowerCase() === "paid") paid += amt;
  }
  return {
    totalRevenue: total.toFixed(2),
    paidRevenue: paid.toFixed(2),
    pendingRevenue: (total - paid).toFixed(2),
  };
}
