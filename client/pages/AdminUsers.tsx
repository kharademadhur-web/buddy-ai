import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, CreditCard, PlusCircle, RefreshCw, ShieldCheck, ToggleRight } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiErrorMessage } from "@/lib/api-base";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CreateUserRole = "doctor" | "receptionist";
type StaffRequest = {
  id: string;
  staff_role: CreateUserRole;
  staff_name: string;
  staff_email: string;
  staff_phone: string;
  payment_status: "pending" | "paid" | "failed";
  approval_status: "awaiting_payment" | "pending_admin" | "approved" | "rejected";
  amount: number;
  rejection_reason?: string | null;
  refund_id?: string | null;
  created_user_login?: string | null;
  created_at: string;
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
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

function money(amountPaise: number | null | undefined) {
  return `₹${Math.round(Number(amountPaise ?? 0) / 100).toLocaleString("en-IN")}`;
}

function requestBadge(request: StaffRequest) {
  if (request.approval_status === "approved") {
    return <Badge className="bg-success/10 text-success border-success/20">Approved — Active</Badge>;
  }
  if (request.approval_status === "rejected") {
    return <Badge className="bg-error/10 text-error border-error/20">Rejected — Refunded</Badge>;
  }
  if (request.approval_status === "pending_admin") {
    return <Badge className="animate-pulse bg-info/10 text-info border-info/20">Pending Admin Review</Badge>;
  }
  return <Badge className="bg-warning/10 text-warning border-warning/20">Awaiting Payment</Badge>;
}

export default function AdminUsers() {
  const { user } = useAdminAuth();
  const isClinicAdmin = user?.role === "clinic-admin";
  const canToggleUserActive = user?.role === "super-admin";
  const [users, setUsers] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ user_id: string; password: string } | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "doctor" as CreateUserRole,
    clinic_id: "",
    clinic_code: "",
    license_number: "",
    send_credentials_to: "none" as "sms" | "email" | "none",
  });

  const fetchClinics = async () => {
    const res = await apiFetch("/api/admin/clinics");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load clinics");
    setClinics(json.clinics || []);
  };

  const fetchUsers = async () => {
    const res = await apiFetch("/api/admin/users");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load users");
    setUsers(json.users || []);
  };

  const fetchRequests = async () => {
    if (!isClinicAdmin) return;
    const res = await apiFetch("/api/clinic/staff-requests");
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load staff requests");
    setRequests(json.requests || []);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchClinics(), fetchUsers(), fetchRequests()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClinicAdmin]);

  const createUser = async () => {
    setLoading(true);
    setError("");
    setCreatedCredentials(null);
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          phone: createForm.phone,
          email: createForm.email || null,
          role: createForm.role,
          clinic_id: createForm.clinic_id,
          clinic_code: createForm.clinic_code,
          license_number: createForm.role === "doctor" ? createForm.license_number.trim() : null,
          send_credentials_to:
            createForm.send_credentials_to === "none" ? undefined : createForm.send_credentials_to,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to create user");
      setCreatedCredentials(json.credentials || null);
      await fetchUsers();
      setCreateForm((p) => ({ ...p, name: "", phone: "", email: "", license_number: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const startStaffSlotPayment = async () => {
    setPaying(true);
    setError("");
    try {
      await loadRazorpayScript();
      const init = await apiFetch("/api/clinic/staff-requests/initiate", {
        method: "POST",
        body: JSON.stringify({
          staffRole: createForm.role,
          staffName: createForm.name,
          staffEmail: createForm.email,
          staffPhone: createForm.phone,
        }),
      });
      const initJson = await init.json();
      if (!init.ok || !initJson.success) throw new Error(apiErrorMessage(initJson) || "Could not start payment");

      const Razorpay = window.Razorpay;
      if (!Razorpay) throw new Error("Razorpay failed to load");
      const rzp = new Razorpay({
        key: initJson.razorpayKeyId,
        amount: initJson.amount,
        currency: initJson.currency || "INR",
        order_id: initJson.razorpayOrderId,
        name: "SmartClinic Staff Slot",
        description: `1 x ${createForm.role === "doctor" ? "Doctor" : "Receptionist"} slot`,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verify = await apiFetch("/api/clinic/staff-requests/verify-payment", {
              method: "POST",
              body: JSON.stringify({
                requestId: initJson.requestId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const verifyJson = await verify.json();
            if (!verify.ok || !verifyJson.success) {
              throw new Error(apiErrorMessage(verifyJson) || "Payment verification failed");
            }
            toast.success("Payment successful. Your request is pending admin approval.");
            setCreateOpen(false);
            setCreateForm((p) => ({ ...p, name: "", phone: "", email: "" }));
            await Promise.all([fetchRequests(), fetchUsers()]);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not verify payment");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
      setPaying(false);
    }
  };

  const clinicById = useMemo(() => {
    const m: Record<string, { name?: string; clinic_code?: string }> = {};
    for (const c of clinics) m[c.id] = c;
    return m;
  }, [clinics]);

  const subForUser = (u: any) => {
    const c = u.clinics;
    return (Array.isArray(c) ? c[0] : c) as
      | { subscription_status?: string; subscription_started_at?: string | null; subscription_expires_at?: string | null }
      | undefined;
  };

  const daysLeft = (exp: string | null | undefined) => {
    if (!exp) return "—";
    const t = new Date(exp).getTime();
    if (Number.isNaN(t)) return "—";
    return String(Math.max(0, Math.ceil((t - Date.now()) / 86400000)));
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to update user");
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const canSubmitDirect =
    loading ||
    !createForm.clinic_id ||
    !createForm.name.trim() ||
    !createForm.phone.trim() ||
    (createForm.role === "doctor" && !createForm.license_number.trim());

  const canPay =
    !paying &&
    Boolean(createForm.name.trim()) &&
    Boolean(createForm.phone.trim()) &&
    Boolean(createForm.email.trim());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Staff management</h2>
          <p className="text-sm text-text-secondary">
            {isClinicAdmin
              ? "Add staff through a paid slot request and track admin approval."
              : "Create and manage doctor and receptionist accounts across clinics."}
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="h-5 w-5" />
                {isClinicAdmin ? "Add Staff Slot" : "Add New User"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{isClinicAdmin ? "Request paid staff slot" : "Create User"}</DialogTitle>
                <DialogDescription>
                  {isClinicAdmin
                    ? "Pay ₹2,500 for one staff slot. The account activates after super-admin approval."
                    : "Create doctor/receptionist users under a clinic. Credentials are shown once."}
                </DialogDescription>
              </DialogHeader>

              {createdCredentials ? (
                <Alert>
                  <AlertDescription className="space-y-2">
                    <div className="font-semibold">Credentials (save now)</div>
                    <div className="font-mono text-sm">
                      user_id: {createdCredentials.user_id}
                      <br />
                      password: {createdCredentials.password}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4">
                {!isClinicAdmin ? (
                  <div className="grid gap-2">
                    <Label>Clinic</Label>
                    <select
                      className="h-11 rounded-xl border-2 border-border bg-card px-3 text-sm focus:border-primary focus:outline-none"
                      value={createForm.clinic_id}
                      onChange={(e) => {
                        const clinicId = e.target.value;
                        const clinic = clinics.find((c) => c.id === clinicId);
                        setCreateForm((p) => ({ ...p, clinic_id: clinicId, clinic_code: clinic?.clinic_code || "" }));
                      }}
                    >
                      <option value="">Select clinic</option>
                      {clinics.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.clinic_code})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label>Staff role</Label>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-1">
                    {(["doctor", "receptionist"] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setCreateForm((p) => ({ ...p, role }))}
                        className={cn(
                          "rounded-xl px-4 py-3 text-sm font-semibold capitalize transition-all active:scale-95",
                          createForm.role === role
                            ? role === "doctor"
                              ? "bg-role-doctor text-white shadow-sm"
                              : "bg-role-receptionist text-white shadow-sm"
                            : "text-text-secondary hover:bg-white"
                        )}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email {isClinicAdmin ? "" : "(optional)"}</Label>
                  <Input id="email" type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} />
                </div>

                {!isClinicAdmin && createForm.role === "doctor" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="license">License number *</Label>
                    <Input id="license" value={createForm.license_number} onChange={(e) => setCreateForm((p) => ({ ...p, license_number: e.target.value }))} />
                  </div>
                ) : null}

                {isClinicAdmin ? (
                  <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-accent p-2 text-white">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-text-primary">
                          Adding a {createForm.role === "doctor" ? "doctor" : "receptionist"} costs ₹2,500
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          1 x {createForm.role === "doctor" ? "Doctor" : "Receptionist"} slot — ₹2,500. Account credentials are sent only after admin approval.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label>Send credentials to</Label>
                    <select
                      className="h-11 rounded-xl border-2 border-border bg-card px-3 text-sm focus:border-primary focus:outline-none"
                      value={createForm.send_credentials_to}
                      onChange={(e) => setCreateForm((p) => ({ ...p, send_credentials_to: e.target.value as any }))}
                    >
                      <option value="none">Don’t send (show on screen)</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                )}
              </div>

              <DialogFooter>
                {isClinicAdmin ? (
                  <Button onClick={startStaffSlotPayment} disabled={!canPay} className="gap-2 bg-accent hover:bg-accent-dark">
                    <CreditCard className="h-4 w-4" />
                    Proceed to Payment
                  </Button>
                ) : (
                  <Button onClick={createUser} disabled={canSubmitDirect}>
                    Create
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isClinicAdmin ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Staff Requests</h3>
              <p className="text-sm text-text-secondary">Track payment, approval, activation, and refunds.</p>
            </div>
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-surface text-xs uppercase text-text-secondary">
                <tr>
                  {["Name", "Role", "Amount Paid", "Payment Status", "Approval Status", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-secondary">
                      No staff requests yet. Paid staff slots will appear here.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id} className="transition-colors hover:bg-primary/5">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-text-primary">{request.staff_name}</div>
                        <div className="text-xs text-text-secondary">{request.staff_email}</div>
                      </td>
                      <td className="px-4 py-4 capitalize">{request.staff_role}</td>
                      <td className="px-4 py-4 font-semibold">{money(request.amount)}</td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={request.payment_status === "paid" ? "border-success/30 text-success" : "border-warning/30 text-warning"}>
                          {request.payment_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">{requestBadge(request)}</td>
                      <td className="px-4 py-4 text-sm text-text-secondary">{new Date(request.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-4">
                        {request.approval_status === "approved" ? (
                          <div className="rounded-xl bg-success/10 p-3 text-xs text-success">
                            <CheckCircle2 className="mb-1 h-4 w-4" />
                            Active user ID: <span className="font-mono">{request.created_user_login ?? "Sent by email"}</span>
                          </div>
                        ) : request.approval_status === "rejected" ? (
                          <div className="max-w-xs rounded-xl bg-error/10 p-3 text-xs text-error">
                            {request.rejection_reason}
                            {request.refund_id ? <div className="mt-1 font-mono">Refund: {request.refund_id}</div> : null}
                          </div>
                        ) : (
                          <span className="text-sm text-text-muted">Awaiting next step</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-surface text-xs uppercase text-text-secondary">
              <tr>
                {["Name", "Role", "Clinic", "Subscription", "Start", "Expiry", "Days left", "Created", "Status", "Action"].map((h) => (
                  <th key={h} className={cn("px-6 py-4 text-left font-semibold", h === "Action" && "text-center")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((row) => {
                const sub = subForUser(row);
                const cc = row.clinic_id ? clinicById[row.clinic_id] : undefined;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-primary/5">
                    <td className="px-6 py-4 font-semibold text-text-primary">
                      {row.name}
                      <div className="font-mono text-xs font-normal text-text-muted">{row.user_id}</div>
                    </td>
                    <td className="px-6 py-4 capitalize text-text-secondary">{row.role}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {cc ? (
                        <>
                          <div>{cc.name}</div>
                          <div className="font-mono text-xs text-text-muted">{cc.clinic_code}</div>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4"><Badge variant="outline">{sub?.subscription_status ?? "—"}</Badge></td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{sub?.subscription_started_at ? new Date(sub.subscription_started_at).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{sub?.subscription_expires_at ? new Date(sub.subscription_expires_at).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{daysLeft(sub?.subscription_expires_at)}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-6 py-4"><Badge variant={row.is_active ? "secondary" : "outline"}>{row.is_active ? "Active" : "Inactive"}</Badge></td>
                    <td className="px-6 py-4 text-center">
                      <button
                        className="rounded-xl p-2 text-text-secondary opacity-70 transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                        disabled={loading || !canToggleUserActive}
                        onClick={() => toggleActive(row.id, Boolean(row.is_active))}
                        title={canToggleUserActive ? "Toggle active" : "Only super admin can toggle"}
                        type="button"
                      >
                        <ToggleRight className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
