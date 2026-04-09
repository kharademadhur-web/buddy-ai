import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp, AlertCircle, Loader2, IndianRupee, Ban, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api-base";
import { OnboardingCalendar } from "@/components/OnboardingCalendar";

interface SaasSummary {
  totalClinics: number;
  liveClinics: number;
  suspendedClinics: number;
  paymentDueClinics: number;
  monthlyRevenueSaaS: number;
  month: string;
}

interface SaasPaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  period_end?: string | null;
  clinics?: { name?: string; clinic_code?: string } | null;
}

interface OnboardClinic {
  id: string;
  name: string;
  clinic_code: string;
  created_at: string;
  subscription_status?: string;
}

export default function AdminDashboardSuperAdmin() {
  const { user } = useAdminAuth();
  const [summary, setSummary] = useState<SaasSummary | null>(null);
  const [payments, setPayments] = useState<SaasPaymentRow[]>([]);
  const [onboards, setOnboards] = useState<OnboardClinic[]>([]);
  const [pendingOnboardCount, setPendingOnboardCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessToken = sessionStorage.getItem("admin_access_token") || "";

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [sRes, pRes, oRes] = await Promise.all([
          apiFetch("/api/admin/analytics/saas-summary"),
          apiFetch("/api/admin/analytics/saas-payments?limit=30"),
          apiFetch("/api/admin/analytics/onboarding-clinics?days=90"),
        ]);

        const sJson = await sRes.json();
        if (sRes.ok && sJson.success && sJson.summary) {
          setSummary(sJson.summary);
        }

        const pJson = await pRes.json();
        if (pRes.ok && pJson.success) {
          setPayments(pJson.payments || []);
        }

        const oJson = await oRes.json();
        if (oRes.ok && oJson.success) {
          setOnboards(oJson.clinics || []);
          setPendingOnboardCount(oJson.pendingCount ?? 0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    if (accessToken) load();
  }, [accessToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Monthly revenue</CardTitle>
            <CardDescription>{summary?.month ?? ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-900">
                ₹{Number(summary?.monthlyRevenueSaaS ?? 0).toLocaleString("en-IN")}
              </div>
              <IndianRupee className="h-8 w-8 text-violet-500 opacity-30" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Base plan ₹5,999/mo per clinic</p>
          </CardContent>
        </Card>

        <Link to="/admin-dashboard/clinics" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
          <Card className="h-full transition-shadow hover:shadow-md cursor-pointer border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total clinic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-gray-900">{summary?.totalClinics ?? 0}</div>
                <Building2 className="h-8 w-8 text-blue-500 opacity-30" />
              </div>
              <p className="text-xs text-blue-600 mt-2">Open clinic list</p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total suspended</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-gray-800">{summary?.suspendedClinics ?? 0}</div>
              <Ban className="h-8 w-8 text-gray-400 opacity-40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active clinic</CardTitle>
            <CardDescription>Active subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-emerald-700">{summary?.liveClinics ?? 0}</div>
              <TrendingUp className="h-8 w-8 text-emerald-500 opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>Recorded SaaS subscription payments</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-600">
                      <th className="py-2 pr-2">Clinic</th>
                      <th className="py-2 pr-2">Amount</th>
                      <th className="py-2">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2">
                          <div className="font-medium text-gray-900">
                            {p.clinics?.name ?? "—"}
                          </div>
                          <div className="text-xs font-mono text-gray-500">{p.clinics?.clinic_code}</div>
                        </td>
                        <td className="py-2 pr-2">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                        <td className="py-2 text-gray-600">
                          {new Date(p.paid_at).toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button asChild variant="outline" className="mt-4 w-full sm:w-auto" size="sm">
              <Link to="/admin-dashboard/clinics">Manage clinics & payments</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>New onboards</CardTitle>
                <CardDescription>Recent clinics (90 days)</CardDescription>
              </div>
              {pendingOnboardCount > 0 ? (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {pendingOnboardCount} pending payment
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {onboards.length === 0 ? (
              <p className="text-sm text-gray-500">No recent onboardings.</p>
            ) : (
              <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                {onboards.slice(0, 12).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 text-sm border-b border-gray-50 pb-2">
                    <div>
                      <Link
                        to={`/admin-dashboard/clinic/${c.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs font-mono text-gray-500">{c.clinic_code}</div>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      {new Date(c.created_at).toLocaleDateString("en-IN")}
                      <div>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {c.subscription_status ?? "—"}
                        </Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding calendar</CardTitle>
          <CardDescription>Clinic creation dates (last 90 days loaded)</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingCalendar clinics={onboards} />
        </CardContent>
      </Card>
    </div>
  );
}
