import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-900">Device Approvals</div>
          <div className="text-sm text-gray-600">Approve or reject pending device changes.</div>
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
        {requests.length === 0 && !loading ? (
          <div className="text-sm text-gray-600">No pending requests.</div>
        ) : null}

        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">
                {r.users?.name || "User"}{" "}
                <span className="ml-2 font-mono text-xs text-gray-500">{r.users?.user_id}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Requested:{" "}
                <span className="font-mono">
                  {r.new_device_id || r.device_id || r.device_fingerprint || "unknown"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{r.status}</Badge>
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

