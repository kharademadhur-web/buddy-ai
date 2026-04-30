import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type DeviceRequest = {
  id: string;
  user_id: string;
  new_device_id?: string | null;
  device_id?: string | null;
  device_fingerprint?: string | null;
  status: string;
  created_at: string;
  expires_at?: string | null;
  users?: { user_id: string; name: string; phone?: string | null; email?: string | null } | null;
};

export default function AdminDeviceApprovals() {
  const { tokens } = useAdminAuth();
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const res = await apiFetch("/api/admin/device-approval/pending", { headers });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(apiErrorMessage(json) || "Failed to load pending requests");
      }
      setRequests(json.requests || []);
    } catch (e) {
      setError(errorMessageFromUnknown(e, "Failed to load pending requests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/device-approval/${id}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(apiErrorMessage(json) || "Failed to approve");
      }
      await fetchPending();
    } catch (e) {
      setError(errorMessageFromUnknown(e, "Failed to approve"));
    } finally {
      setLoading(false);
    }
  };

  const reject = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/device-approval/${id}/reject`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(apiErrorMessage(json) || "Failed to reject");
      }
      await fetchPending();
    } catch (e) {
      setError(errorMessageFromUnknown(e, "Failed to reject"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-bold text-text-primary">Device Approvals</div>
          <div className="text-sm text-text-secondary">Approve or reject pending device changes.</div>
        </div>
        <Button variant="outline" onClick={fetchPending} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </>
        ) : null}
        {requests.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-primary/40" />
            <p className="font-semibold text-text-primary">No pending device requests</p>
            <p className="text-sm text-text-secondary">New device approvals will appear here.</p>
          </div>
        ) : null}

        {requests.map((r) => (
          <div key={r.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-text-primary">
                {r.users?.name || "User"}{" "}
                <span className="ml-2 font-mono text-xs text-text-muted">{r.users?.user_id}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                <KeyRound className="h-3 w-3" />
                Requested:{" "}
                <span className="font-mono">
                  {r.new_device_id || r.device_id || r.device_fingerprint || "unknown"}
                </span>
              </div>
              <div className="mt-1 text-xs text-text-muted">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-info/20 bg-info/10 text-info">{r.status}</Badge>
              <Button size="sm" onClick={() => approve(r.id)} disabled={loading}>
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => reject(r.id)} disabled={loading}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

