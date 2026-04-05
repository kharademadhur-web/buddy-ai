import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Activity,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-base";

interface AuditRow {
  id: string;
  action: string;
  resource_type?: string;
  created_at: string;
}

export default function AdminOverview() {
  const [clinicCount, setClinicCount] = useState(0);
  const [userStats, setUserStats] = useState<{
    activeUsers: number;
    doctors: number;
    receptionists: number;
  } | null>(null);
  const [revenue, setRevenue] = useState<{
    paidRevenue: string;
    pendingRevenue: string;
  } | null>(null);
  const [trends, setTrends] = useState<Array<{ month: string; paid: number; pending: number }>>([]);
  const [activity, setActivity] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("admin_access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setError(null);
        const [cRes, uRes, rRes, tRes, aRes] = await Promise.all([
          apiFetch("/api/admin/analytics/clinics"),
          apiFetch("/api/admin/analytics/users"),
          apiFetch("/api/admin/analytics/revenue"),
          apiFetch("/api/admin/analytics/trends?months=6"),
          apiFetch("/api/admin/analytics/audit-logs?limit=8&days=14"),
        ]);

        const [cJson, uJson, rJson, tJson, aJson] = await Promise.all([
          cRes.json(),
          uRes.json(),
          rRes.json(),
          tRes.json(),
          aRes.json(),
        ]);

        if (cRes.ok && cJson.success) setClinicCount((cJson.clinics || []).length);
        if (uRes.ok && uJson.success)
          setUserStats({
            activeUsers: uJson.stats?.activeUsers ?? 0,
            doctors: uJson.stats?.doctors ?? 0,
            receptionists: uJson.stats?.receptionists ?? 0,
          });
        if (rRes.ok && rJson.success && rJson.revenue)
          setRevenue({
            paidRevenue: rJson.revenue.paidRevenue ?? "0",
            pendingRevenue: rJson.revenue.pendingRevenue ?? "0",
          });
        if (tRes.ok && tJson.success) setTrends(tJson.trends || []);
        if (aRes.ok && aJson.success) setActivity(aJson.logs || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load overview");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalRevenueDisplay = revenue
    ? (Number(revenue.paidRevenue) + Number(revenue.pendingRevenue)).toFixed(0)
    : "0";

  const maxTrend = Math.max(0, ...trends.map((x) => x.paid + x.pending), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading overview…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Clinics</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{clinicCount}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Active Users</p>
              <p className="text-3xl font-bold text-green-900 mt-2">
                {userStats?.activeUsers ?? 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Doctors</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">{userStats?.doctors ?? 0}</p>
            </div>
            <Users className="w-8 h-8 text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-600 text-sm font-medium">Reception</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">
                {userStats?.receptionists ?? 0}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-yellow-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-sm font-medium">Revenue (all)</p>
              <p className="text-2xl font-bold text-red-900 mt-2">₹{totalRevenueDisplay}</p>
              <p className="text-xs text-red-700 mt-1">
                Paid ₹{revenue?.paidRevenue ?? "0"} · Pending ₹{revenue?.pendingRevenue ?? "0"}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-red-400 opacity-50" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Monthly Revenue Trend</h3>
        {trends.length === 0 ? (
          <p className="text-gray-500 text-sm">No trend data yet.</p>
        ) : (
          <div className="flex items-end justify-between h-64 gap-2">
            {trends.map((data) => (
              <div key={data.month} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg mb-2"
                  style={{
                    height: `${((data.paid + data.pending) / maxTrend) * 200}px`,
                  }}
                />
                <span className="text-xs font-semibold text-gray-600">{data.month}</span>
                <span className="text-xs text-gray-500 mt-1">
                  ₹{data.paid.toFixed(0)} / ₹{data.pending.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Payment snapshot</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-gray-900">Paid (recorded)</span>
              </div>
              <span className="text-2xl font-bold text-green-600">
                ₹{revenue?.paidRevenue ?? "0"}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Pending</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                ₹{revenue?.pendingRevenue ?? "0"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent activity</h3>
          <div className="space-y-4">
            {activity.length === 0 ? (
              <p className="text-sm text-gray-500">No audit events in the selected window.</p>
            ) : (
              activity.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="mt-1">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {row.action}
                      {row.resource_type ? ` · ${row.resource_type}` : ""}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
