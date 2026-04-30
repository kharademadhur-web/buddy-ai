import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage, apiFetch } from "@/lib/api-base";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StaffRequest = {
  id: string;
  clinic_id: string;
  staff_role: "doctor" | "receptionist";
  staff_name: string;
  staff_email: string;
  staff_phone: string;
  payment_status: string;
  approval_status: "awaiting_payment" | "pending_admin" | "approved" | "rejected";
  amount: number;
  rejection_reason?: string | null;
  refund_id?: string | null;
  created_user_login?: string | null;
  created_at: string;
  clinics?: { name?: string; clinic_code?: string } | null;
};

function money(amountPaise: number) {
  return `₹${Math.round(Number(amountPaise || 0) / 100).toLocaleString("en-IN")}`;
}

function approvalBadge(status: StaffRequest["approval_status"]) {
  const map = {
    awaiting_payment: "border-warning/30 bg-warning/10 text-warning",
    pending_admin: "animate-pulse border-info/30 bg-info/10 text-info",
    approved: "border-success/30 bg-success/10 text-success",
    rejected: "border-error/30 bg-error/10 text-error",
  };
  const label = {
    awaiting_payment: "Awaiting payment",
    pending_admin: "Pending admin",
    approved: "Approved",
    rejected: "Rejected",
  };
  return <Badge className={map[status]}>{label[status]}</Badge>;
}

export default function AdminStaffRequests() {
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState<StaffRequest | null>(null);
  const [rejecting, setRejecting] = useState<StaffRequest | null>(null);
  const [reason, setReason] = useState("");
  const [credentials, setCredentials] = useState<{ userId: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.approval_status === "pending_admin").length,
    [requests]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/staff-requests");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load staff requests");
      setRequests(json.requests || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const approve = async () => {
    if (!approving) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/staff-requests/${approving.id}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Could not approve request");
      setCredentials({ userId: json.newUserId, password: json.tempPassword });
      toast.success("Staff account activated.");
      setApproving(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve request");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/staff-requests/${rejecting.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Could not reject request");
      toast.success("Request rejected and refund initiated.");
      setRejecting(null);
      setReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject request");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">Staff Slot Requests</h2>
            {pendingCount > 0 ? <Badge className="animate-pulse bg-error text-white">{pendingCount} pending</Badge> : null}
          </div>
          <p className="text-sm text-text-secondary">
            Review paid staff slot requests, activate accounts, or reject with an automatic refund.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-surface text-xs uppercase text-text-secondary">
              <tr>
                {["Clinic Name", "Staff Name", "Role", "Amount", "Payment", "Date", "Actions"].map((h) => (
                  <th key={h} className={cn("px-5 py-4 text-left font-semibold", h === "Actions" && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-primary/40" />
                    <p className="font-semibold text-text-primary">No staff requests yet</p>
                    <p className="text-sm text-text-secondary">Paid slot requests will appear here for review.</p>
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-primary/5">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-text-primary">{request.clinics?.name ?? "Clinic"}</div>
                      <div className="font-mono text-xs text-text-muted">{request.clinics?.clinic_code ?? request.clinic_id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-text-primary">{request.staff_name}</div>
                      <div className="text-xs text-text-secondary">{request.staff_email} · {request.staff_phone}</div>
                    </td>
                    <td className="px-5 py-4 capitalize">{request.staff_role}</td>
                    <td className="px-5 py-4 font-semibold">{money(request.amount)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-2">
                        <Badge variant="outline" className={request.payment_status === "paid" ? "border-success/30 text-success" : "border-warning/30 text-warning"}>
                          {request.payment_status}
                        </Badge>
                        {approvalBadge(request.approval_status)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-text-secondary">{new Date(request.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-4 text-right">
                      {request.approval_status === "pending_admin" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setApproving(request)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setRejecting(request)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      ) : request.approval_status === "approved" ? (
                        <span className="font-mono text-xs text-success">{request.created_user_login ?? "Activated"}</span>
                      ) : request.approval_status === "rejected" ? (
                        <span className="text-xs text-error">Refund: {request.refund_id ?? "initiated"}</span>
                      ) : (
                        <span className="text-xs text-text-muted">Waiting for payment</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(approving)} onOpenChange={(open) => !open && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm approval</DialogTitle>
            <DialogDescription>
              You are about to activate a {approving?.staff_role} account for {approving?.staff_name} at {approving?.clinics?.name ?? "this clinic"}.
              Login credentials will be auto-generated and emailed to them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>Cancel</Button>
            <Button onClick={approve} disabled={busy}>Confirm Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>₹2,500 will be automatically refunded to the clinic.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter rejection reason"
            className="min-h-28"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={busy || !reason.trim()}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credentials)} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generated credentials</DialogTitle>
            <DialogDescription>These credentials have also been emailed to the new staff member.</DialogDescription>
          </DialogHeader>
          {credentials ? (
            <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
              <div className="grid gap-2 font-mono text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>User ID: {credentials.userId}</span>
                  <button type="button" onClick={() => void copy(credentials.userId)} className="rounded-lg p-2 hover:bg-white">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Password: {credentials.password}</span>
                  <button type="button" onClick={() => void copy(credentials.password)} className="rounded-lg p-2 hover:bg-white">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
