import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-base";

export default function ClinicDetail() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const { tokens } = useAdminAuth();
  const [clinic, setClinic] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessReason, setAccessReason] = useState("");

  const headers = useMemo(() => {
    const accessToken = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }, [tokens?.accessToken]);

  const fetchClinic = async () => {
    if (!clinicId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load clinic");
      setClinic(json.clinic);
      setAccessReason(json.clinic?.access_reason || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinic");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const updateAccess = async (patch: { is_suspended?: boolean; read_only?: boolean }) => {
    if (!clinicId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}/access`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...patch, reason: accessReason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update access");
      setClinic(json.clinic);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update access");
    } finally {
      setLoading(false);
    }
  };

  if (!clinic) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate("/admin-dashboard/clinics")}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Clinics
        </button>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}
          <p className="text-gray-600 text-lg">{loading ? "Loading..." : "Clinic not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate("/admin-dashboard/clinics")}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Clinics
      </button>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border bg-white p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">{clinic.name}</div>
            <div className="text-sm text-gray-600 mt-1 font-mono">{clinic.clinic_code}</div>
            <div className="text-sm text-gray-600 mt-1">{clinic.address}</div>
            <div className="text-sm text-gray-600">{clinic.phone}</div>
            <div className="text-sm text-gray-600">{clinic.email}</div>
          </div>
          <Button variant="outline" onClick={fetchClinic} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="accessReason">Access reason (optional)</Label>
          <Input
            id="accessReason"
            value={accessReason}
            onChange={(e) => setAccessReason(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => updateAccess({ is_suspended: false })}
          >
            Activate
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() => updateAccess({ is_suspended: true })}
          >
            Suspend
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => updateAccess({ read_only: true })}
          >
            Set Read-only
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => updateAccess({ read_only: false })}
          >
            Disable Read-only
          </Button>
        </div>
      </div>
    </div>
  );
}
