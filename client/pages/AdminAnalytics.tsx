import React, { useState, useEffect } from "react";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        <p className="font-semibold">Note:</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Revenue analytics</h2>
        <p className="mt-1 text-sm text-gray-600">{scopedCopy}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Revenue Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">
                Total Revenue Earned
              </p>
              <h3 className="text-3xl font-bold text-gray-900">
                ₹{(data?.totalRevenue || 0).toLocaleString("en-IN")}
              </h3>
              <p className="text-gray-500 text-sm mt-2">Paid bill totals (all time)</p>
            </div>
            <div className="bg-green-100 rounded-full p-4">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Total Pending Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">
                Total Pending Amount
              </p>
              <h3 className="text-3xl font-bold text-gray-900">
                ₹{(data?.totalPending || 0).toLocaleString("en-IN")}
              </h3>
              <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                Needs attention
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-4">
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Amount Paid - Monthly Trend
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data?.revenueTrend || []}>
            <CartesianGrid strokeDasharray="3 3" />
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
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name="Amount Paid"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pending by Clinic Chart */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Amount Pending by Clinic
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data?.pendingByClinic || []}>
            <CartesianGrid strokeDasharray="3 3" />
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
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <Legend />
            <Bar
              dataKey="amount"
              fill="#ef4444"
              name="Pending Amount"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
