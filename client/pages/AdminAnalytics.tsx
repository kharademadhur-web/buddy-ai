import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";

interface AnalyticsData {
  totalRevenue: number;
  totalPending: number;
  revenueTrend: Array<{ date: string; amount: number }>;
  pendingByClinic: Array<{ clinicName: string; amount: number }>;
}

export default function AdminAnalytics() {
  const { user } = useAdminAuth();
  const scopedCopy =
    user?.role === "clinic-admin"
      ? "Figures below are scoped to your clinic (bill payments and pending amounts)."
      : "Platform-wide totals from bill payment data.";

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError("");

      const accessToken = sessionStorage.getItem("admin_access_token") || "";
      if (!accessToken) throw new Error("Not authenticated");

      const [revRes, trendsRes, clinicsRes] = await Promise.all([
        apiFetch("/api/admin/analytics/revenue"),
        apiFetch("/api/admin/analytics/trends?months=12"),
        apiFetch("/api/admin/analytics/clinics"),
      ]);

      const [revJson, trendsJson, clinicsJson] = await Promise.all([
        revRes.json(),
        trendsRes.json(),
        clinicsRes.json(),
      ]);

      if (!revRes.ok || !revJson.success) {
        throw new Error(apiErrorMessage(revJson) || "Failed to fetch revenue analytics");
      }
      if (!trendsRes.ok || !trendsJson.success) {
        throw new Error(apiErrorMessage(trendsJson) || "Failed to fetch trend analytics");
      }
      if (!clinicsRes.ok || !clinicsJson.success) {
        throw new Error(apiErrorMessage(clinicsJson) || "Failed to fetch clinic analytics");
      }

      const totalRevenue = Number(revJson.revenue?.paidRevenue || 0);
      const totalPending = Number(revJson.revenue?.pendingRevenue || 0);

      const revenueTrend = (trendsJson.trends || []).map((t: any) => ({
        date: t.month,
        amount: Number(t.paid || 0),
      }));

      const pendingByClinic = (clinicsJson.clinics || []).map((c: any) => ({
        clinicName: c.name,
        amount: Number(c.pendingRevenue || 0),
      }));

      setData({
        totalRevenue,
        totalPending,
        revenueTrend,
        pendingByClinic,
      });
    } catch (err) {
      setError(errorMessageFromUnknown(err, "Failed to fetch analytics"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-warning/25 bg-warning/10 p-4 text-sm text-text-primary">
        <p className="font-semibold">Note:</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Revenue analytics</h2>
        <p className="mt-1 text-sm text-text-secondary">{scopedCopy}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Revenue Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm font-medium text-text-secondary">
                Total Revenue Earned
              </p>
              <h3 className="animate-count-up text-3xl font-bold text-text-primary">
                ₹{(data?.totalRevenue || 0).toLocaleString("en-IN")}
              </h3>
              <p className="mt-2 text-sm text-text-muted">Paid bill totals (all time)</p>
            </div>
            <div className="rounded-2xl bg-success/10 p-4">
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </div>
        </div>

        {/* Total Pending Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm font-medium text-text-secondary">
                Total Pending Amount
              </p>
              <h3 className="animate-count-up text-3xl font-bold text-text-primary">
                ₹{(data?.totalPending || 0).toLocaleString("en-IN")}
              </h3>
              <p className="mt-2 flex items-center gap-1 text-sm text-error">
                <TrendingDown className="w-4 h-4" />
                Needs attention
              </p>
            </div>
            <div className="rounded-2xl bg-error/10 p-4">
              <TrendingDown className="h-8 w-8 text-error" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2"><BarChart3 className="h-5 w-5 text-primary" /></div>
          <h3 className="text-lg font-semibold text-text-primary">Amount Paid - Monthly Trend</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data?.revenueTrend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #E9ECEF",
                borderRadius: "16px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#2D6A4F"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Amount Paid"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pending by Clinic Chart */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-error/10 p-2"><TrendingDown className="h-5 w-5 text-error" /></div>
          <h3 className="text-lg font-semibold text-text-primary">Amount Pending by Clinic</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data?.pendingByClinic || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" />
            <XAxis
              dataKey="clinicName"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #E9ECEF",
                borderRadius: "16px",
              }}
            />
            <Legend />
            <Bar
              dataKey="amount"
              fill="#FA5252"
              name="Pending Amount"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
