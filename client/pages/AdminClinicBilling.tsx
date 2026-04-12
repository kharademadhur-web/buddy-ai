import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";
import { toast } from "sonner";

type ClinicRow = {
  id: string;
  name: string;
  clinic_code: string;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  saas_plan_amount_monthly?: number | null;
  days_remaining?: number | null;
  last_saas_payment?: { amount?: number; paid_at?: string } | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  period_start?: string | null;
  period_end?: string | null;
  status?: string | null;
  notes?: string | null;
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

export default function AdminClinicBilling() {
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(user?.clinic_id ?? null);
  const [clinicChoices, setClinicChoices] = useState<Array<{ id: string; name: string; clinic_code: string }>>([]);

  const clinicId = selectedClinicId;
  const [clinic, setClinic] = useState<ClinicRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState("1");
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void apiFetch("/api/admin/clinics")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.clinics)) {
          setClinicChoices(
            j.clinics.map((c: { id: string; name: string; clinic_code: string }) => ({
              id: c.id,
              name: c.name,
              clinic_code: c.clinic_code,
            }))
          );
          setSelectedClinicId((prev) => prev ?? j.clinics[0]?.id ?? null);
        }
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(async () => {
    if (!clinicId) {
      if (!isSuperAdmin) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cRes, pRes, stRes] = await Promise.all([
        apiFetch(`/api/admin/clinics/${clinicId}`),
        apiFetch(`/api/admin/analytics/saas-payments?limit=100&clinicId=${encodeURIComponent(clinicId)}`),
        apiFetch("/api/admin/billing-saas/status"),
      ]);
      const cJson = await cRes.json();
      if (!cRes.ok || !cJson.success) throw new Error(apiErrorMessage(cJson) || "Failed to load clinic");
      setClinic(cJson.clinic as ClinicRow);

      const pJson = await pRes.json();
      if (pRes.ok && pJson.success) {
        setPayments(Array.isArray(pJson.payments) ? pJson.payments : []);
      }

      const stJson = await stRes.json();
      setPaymentsEnabled(stRes.ok && stJson.success && stJson.configured === true);
    } catch (e) {
      setError(errorMessageFromUnknown(e, "Failed to load billing"));
    } finally {
      setLoading(false);
    }
  }, [clinicId, isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCheckout = async () => {
    if (!clinicId) return;
    setPaying(true);
    setError(null);
    try {
      await loadRazorpayScript();
      const res = await apiFetch("/api/admin/billing-saas/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          months: parseInt(months, 10) || 1,
          ...(isSuperAdmin && clinicId ? { clinicId } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        throw new Error(apiErrorMessage(j) || "Could not start payment");
      }

      const key = j.keyId as string;
      const orderId = j.orderId as string;
      const amount = j.amount as number;
      const Razorpay = window.Razorpay;
      if (!Razorpay) throw new Error("Razorpay failed to load");

      const rzp = new Razorpay({
        key,
        amount,
        currency: j.currency || "INR",
        order_id: orderId,
        name: "SmartClinic SaaS",
        description: `Subscription (${j.months} mo.)`,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const v = await apiFetch("/api/admin/billing-saas/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const vj = await v.json();
            if (!v.ok || !vj.success) throw new Error(apiErrorMessage(vj) || "Verification failed");
            toast.success("Subscription updated successfully.");
            await load();
          } catch (e) {
            toast.error(errorMessageFromUnknown(e, "Could not verify payment"));
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.open();
    } catch (e) {
      setError(errorMessageFromUnknown(e, "Payment failed"));
      setPaying(false);
    }
  };

  if (!clinicId && !isSuperAdmin) {
    return (
      <Alert>
        <AlertDescription>No clinic is linked to this account.</AlertDescription>
      </Alert>
    );
  }

  if (isSuperAdmin && clinicChoices.length === 0 && !loading) {
    return (
      <Alert>
        <AlertDescription>No clinics found.</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const status = (clinic?.subscription_status || "").toLowerCase();
  const exp = clinic?.subscription_expires_at ? new Date(clinic.subscription_expires_at) : null;
  const expOk = exp && !Number.isNaN(exp.getTime()) && exp.getTime() > Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Billing &amp; subscription</h2>
          <p className="text-sm text-gray-600">
            Plan, renewal date, payment history, and online renewal for your clinic.
          </p>
        </div>
        {clinicId ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/admin-dashboard/clinic/${clinicId}`}>
              Clinic settings <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        ) : null}
      </div>

      {isSuperAdmin && clinicChoices.length > 0 ? (
        <div className="max-w-md space-y-2">
          <Label>Clinic</Label>
          <Select
            value={selectedClinicId ?? ""}
            onValueChange={(v) => setSelectedClinicId(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinicChoices.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.clinic_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current plan
            </CardTitle>
            <CardDescription>{clinic?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Status:</span>
              <Badge variant={status === "live" && expOk ? "default" : "destructive"}>
                {clinic?.subscription_status ?? "—"}
              </Badge>
            </div>
            <p className="text-sm text-gray-700">
              Monthly plan: ₹
              {Number(clinic?.saas_plan_amount_monthly ?? 5999).toLocaleString("en-IN")}
            </p>
            {exp ? (
              <p className="text-sm text-gray-700">
                Current period ends:{" "}
                <span className="font-medium">{exp.toLocaleDateString("en-IN")}</span>
                {clinic?.days_remaining != null ? (
                  <span className="text-gray-500"> ({clinic.days_remaining} days)</span>
                ) : null}
              </p>
            ) : null}
            {clinic?.last_saas_payment ? (
              <p className="text-xs text-gray-500">
                Last recorded payment: ₹
                {Number((clinic.last_saas_payment as { amount?: number }).amount ?? 0).toLocaleString("en-IN")}{" "}
                on{" "}
                {(clinic.last_saas_payment as { paid_at?: string }).paid_at
                  ? new Date((clinic.last_saas_payment as { paid_at: string }).paid_at).toLocaleDateString("en-IN")
                  : "—"}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pay online</CardTitle>
            <CardDescription>Renew your SaaS subscription securely</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentsEnabled ? (
              <>
                <div className="space-y-2">
                  <Label>Months</Label>
                  <Select value={months} onValueChange={setMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 6, 12].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} month{m > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => void startCheckout()} disabled={paying}>
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Pay with Razorpay
                </Button>
                <p className="text-xs text-gray-500">
                  Configure <code className="text-[10px]">RAZORPAY_KEY_ID</code> and{" "}
                  <code className="text-[10px]">RAZORPAY_KEY_SECRET</code> on the server. Webhook:{" "}
                  <code className="text-[10px]">/api/admin/billing-saas/webhook</code>
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                Online payments are not enabled yet. Contact your platform administrator to record a
                subscription payment, or ask them to configure Razorpay keys.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
          <CardDescription>Recorded SaaS subscription payments for your clinic</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {p.paid_at ? new Date(p.paid_at).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-3 py-2">₹{Number(p.amount ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {p.period_start && p.period_end
                          ? `${new Date(p.period_start).toLocaleDateString("en-IN")} → ${new Date(p.period_end).toLocaleDateString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs truncate">{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
