import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-base";

type DoctorRow = {
  userId: string;
  licenseNumber: string;
  hasDocuments: boolean;
  user: { user_id: string; name: string; clinic_id?: string | null } | null;
};

export default function AdminKycReview() {
  const { tokens } = useAdminAuth();
  const [rows, setRows] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [docs, setDocs] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const headers = useMemo(() => {
    const accessToken = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }, [tokens?.accessToken]);

  const fetchPending = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/kyc/doctors?status=pending", { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load KYC queue");
      setRows(json.doctors || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KYC queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDoctor = async (userId: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/kyc/doctor/${userId}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load doctor KYC");
      setSelected(json.doctor);
      setDocs(json.documents);
      setDialogOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load doctor KYC");
    } finally {
      setLoading(false);
    }
  };

  const approve = async () => {
    if (!selected?.userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/kyc/doctor/${selected.userId}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ note: "Approved via Admin Portal" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to approve");
      setDialogOpen(false);
      await fetchPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    if (!selected?.userId) return;
    const reason = "Rejected via Admin Portal";
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/kyc/doctor/${selected.userId}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to reject");
      setDialogOpen(false);
      await fetchPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-900">KYC Review</div>
          <div className="text-sm text-gray-600">Review doctor documents and approve/reject.</div>
        </div>
        <Button variant="outline" onClick={fetchPending} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 && !loading ? (
          <div className="text-sm text-gray-600">No pending KYC submissions.</div>
        ) : null}

        {rows.map((r) => (
          <div key={r.userId} className="rounded-lg border bg-white p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">
                {r.user?.name || "Doctor"}{" "}
                <span className="ml-2 font-mono text-xs text-gray-500">{r.user?.user_id}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">License: {r.licenseNumber}</div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{r.hasDocuments ? "submitted" : "missing docs"}</Badge>
              <Button size="sm" onClick={() => openDoctor(r.userId)} disabled={loading || !r.hasDocuments}>
                Review
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Doctor KYC Documents</DialogTitle>
            <DialogDescription>
              {selected?.user?.name} <span className="font-mono">{selected?.user?.user_id}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["aadhaar", "pan", "signature"].map((k) => {
              const d = docs?.[k];
              return (
                <div key={k} className="rounded-lg border p-3">
                  <div className="text-sm font-semibold capitalize mb-2">{k}</div>
                  {d?.signedUrl ? (
                    <a className="text-sm text-blue-600 underline" href={d.signedUrl} target="_blank" rel="noreferrer">
                      Open signed URL
                    </a>
                  ) : (
                    <div className="text-sm text-gray-600">Not provided</div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={reject} disabled={loading}>
              Reject
            </Button>
            <Button onClick={approve} disabled={loading}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

