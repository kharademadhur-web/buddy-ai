import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Calendar,
  CreditCard,
  Users,
  AlertTriangle,
  Loader2,
  IndianRupee,
} from "lucide-react";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";

type SaasSummary = {
  totalClinics: number;
  liveClinics: number;
  suspendedClinics: number;
  paymentDueClinics: number;
  monthlyRevenueSaaS: number;
  month: string;
};

export default function AdminClinicOverview() {
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id ?? null;
  const [summary, setSummary] = useState<SaasSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch("/api/admin/analytics/saas-summary");
        const j = await res.json();
        if (!res.ok || !j.success) {
          throw new Error(apiErrorMessage(j) || "Failed to load overview");
        }
        if (!cancelled) setSummary(j.summary);
      } catch (e) {
        if (!cancelled) setError(errorMessageFromUnknown(e, "Failed to load overview"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const atRisk = summary && (summary.paymentDueClinics > 0 || summary.suspendedClinics > 0);

  return (
    <div className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-gray-600 mt-1">
          Welcome back, {user?.name}. Manage your clinic subscription, staff, and settings from the sidebar.
        </p>
      </div>

      {atRisk ? (
        <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {summary?.paymentDueClinics ? (
              <span>
                Your subscription needs attention (payment due or expired).{" "}
                <Link to="/admin-dashboard/billing" className="font-semibold underline">
                  Open billing
                </Link>{" "}
                to renew.
              </span>
            ) : (
              <span>Your clinic account may be restricted. Contact support if you need help.</span>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Subscription status</CardTitle>
            <CardDescription>Your SaaS plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {summary?.liveClinics ? (
                <Badge className="bg-emerald-600">Active</Badge>
              ) : (
                <Badge variant="destructive">Action needed</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Renewals and payment history are{" "}
              <Link to="/admin-dashboard/billing" className="text-blue-600 font-medium">
                on the Billing page
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">This month (SaaS)</CardTitle>
            <CardDescription>{summary?.month ?? ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-gray-900">
                ₹{Number(summary?.monthlyRevenueSaaS ?? 0).toLocaleString("en-IN")}
              </div>
              <IndianRupee className="h-8 w-8 text-violet-500 opacity-30" />
            </div>
            <p className="text-xs text-gray-500 mt-2">Recorded subscription payments for your clinic</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {clinicId ? (
              <Button variant="outline" className="justify-start gap-2" asChild>
                <Link to={`/admin-dashboard/clinic/${clinicId}`}>
                  <Building2 className="h-4 w-4" />
                  My clinic
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link to="/admin-dashboard/billing">
                <CreditCard className="h-4 w-4" />
                Billing &amp; subscription
              </Link>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link to="/admin-dashboard/users">
                <Users className="h-4 w-4" />
                Staff users
              </Link>
            </Button>
            <Button variant="outline" className="justify-start gap-2" asChild>
              <Link to="/admin-dashboard/daily-summary">
                <Calendar className="h-4 w-4" />
                Daily summary
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
