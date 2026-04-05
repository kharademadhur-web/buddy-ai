import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, KeyRound } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, apiErrorMessage, apiUrl, getAccessToken } from "@/lib/api-base";

type StaffRow = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  clinic_id: string | null;
};

export default function ClinicDetail() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const { tokens, user } = useAdminAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const [clinic, setClinic] = useState<any>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [kycOpen, setKycOpen] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycDoctorName, setKycDoctorName] = useState("");
  const [kycLicense, setKycLicense] = useState<string | null>(null);
  const [kycDocs, setKycDocs] = useState<Record<string, { path: string; signedUrl: string } | null> | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newCreds, setNewCreds] = useState<{ user_id: string; password: string } | null>(null);

  const [maxDoctors, setMaxDoctors] = useState("");
  const [maxReceptionists, setMaxReceptionists] = useState("");
  const [assignRows, setAssignRows] = useState<Array<{ receptionist_user_id: string; doctor_user_id: string }>>([]);
  const [workflowMsg, setWorkflowMsg] = useState("");

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
      const c = json.clinic;
      setMaxDoctors(c?.max_doctors != null ? String(c.max_doctors) : "");
      setMaxReceptionists(c?.max_receptionists != null ? String(c.max_receptionists) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinic");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    try {
      const res = await apiFetch(`/api/admin/users?clinic_id=${encodeURIComponent(clinicId)}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load staff");
      setStaff(json.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    }
  }, [clinicId, headers]);

  useEffect(() => {
    void fetchClinic();
  }, [clinicId]);

  useEffect(() => {
    if (clinic) void fetchStaff();
  }, [clinic, fetchStaff]);

  const fetchAssignments = useCallback(async () => {
    if (!clinicId || !isSuperAdmin) return;
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}/receptionist-assignments`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load assignments");
      setAssignRows(json.assignments || []);
    } catch (e) {
      setWorkflowMsg(e instanceof Error ? e.message : "Failed to load assignments");
    }
  }, [clinicId, headers, isSuperAdmin]);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  const saveCaps = async () => {
    if (!clinicId || !isSuperAdmin) return;
    setWorkflowMsg("");
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          max_doctors: maxDoctors.trim() === "" ? null : Number(maxDoctors),
          max_receptionists: maxReceptionists.trim() === "" ? null : Number(maxReceptionists),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to save");
      setClinic(json.clinic);
      setWorkflowMsg("Caps saved.");
    } catch (e) {
      setWorkflowMsg(e instanceof Error ? e.message : "Failed to save caps");
    }
  };

  const uploadAsset = async (kind: "letterhead" | "payment_qr", file: File) => {
    if (!clinicId) return;
    setWorkflowMsg("");
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const token = getAccessToken();
    const res = await fetch(apiUrl(`/api/admin/clinics/${clinicId}/clinic-asset`), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Upload failed");
    setClinic(json.clinic);
    setWorkflowMsg(`${kind === "letterhead" ? "Letterhead" : "Payment QR"} uploaded.`);
  };

  const saveAssignments = async () => {
    if (!clinicId || !isSuperAdmin) return;
    setWorkflowMsg("");
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}/receptionist-assignments`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ rows: assignRows }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to save assignments");
      setWorkflowMsg("Assignment matrix saved.");
      await fetchAssignments();
    } catch (e) {
      setWorkflowMsg(e instanceof Error ? e.message : "Failed to save assignments");
    }
  };

  const toggleAssignment = (receptionistId: string, doctorId: string) => {
    setAssignRows((prev) => {
      const has = prev.some((p) => p.receptionist_user_id === receptionistId && p.doctor_user_id === doctorId);
      if (has) {
        return prev.filter((p) => !(p.receptionist_user_id === receptionistId && p.doctor_user_id === doctorId));
      }
      return [...prev, { receptionist_user_id: receptionistId, doctor_user_id: doctorId }];
    });
  };

  const receptionists = staff.filter((s) => s.role === "receptionist");
  const doctors = staff.filter((s) => s.role === "doctor" || s.role === "independent");

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

  const openDoctorKyc = async (row: StaffRow) => {
    if (row.role !== "doctor" && row.role !== "independent") return;
    setKycLoading(true);
    setKycOpen(true);
    setKycDocs(null);
    setKycDoctorName(row.name);
    setKycLicense(null);
    try {
      const res = await apiFetch(`/api/admin/kyc/doctor/${row.id}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load KYC");
      setKycDocs(json.documents || null);
      setKycLicense(json.doctor?.licenseNumber ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KYC");
      setKycOpen(false);
    } finally {
      setKycLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!resetUserId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/users/${resetUserId}/reset-password`, {
        method: "POST",
        headers,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Reset failed");
      setNewCreds(json.credentials || null);
      setResetUserId(null);
      await fetchStaff();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!clinic) {
    return (
      <div className="space-y-4 sm:space-y-6 px-1">
        <button
          type="button"
          onClick={() => navigate("/admin-dashboard/clinics")}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm sm:text-base"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          Back to Clinics
        </button>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center">
          {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}
          <p className="text-gray-600 text-base sm:text-lg">{loading ? "Loading..." : "Clinic not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-1 max-w-6xl">
      <button
        type="button"
        onClick={() => navigate("/admin-dashboard/clinics")}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm sm:text-base"
      >
        <ArrowLeft className="w-5 h-5 shrink-0" />
        Back to Clinics
      </button>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border bg-white p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{clinic.name}</div>
            <div className="text-sm text-gray-600 mt-1 font-mono break-all">{clinic.clinic_code}</div>
            <div className="text-sm text-gray-600 mt-1 break-words">{clinic.address}</div>
            <div className="text-sm text-gray-600 break-all">{clinic.phone}</div>
            <div className="text-sm text-gray-600 break-all">{clinic.email}</div>
            <p className="text-xs text-gray-500 mt-2">
              Internal clinic id: <span className="font-mono">{clinicId}</span> — all staff below belong to this clinic.
            </p>
          </div>
          <Button variant="outline" onClick={() => void fetchClinic()} disabled={loading} className="shrink-0">
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
          <Button variant="outline" disabled={loading} onClick={() => updateAccess({ is_suspended: false })}>
            Activate
          </Button>
          <Button variant="destructive" disabled={loading} onClick={() => updateAccess({ is_suspended: true })}>
            Suspend
          </Button>
          <Button variant="outline" disabled={loading} onClick={() => updateAccess({ read_only: true })}>
            Set Read-only
          </Button>
          <Button variant="outline" disabled={loading} onClick={() => updateAccess({ read_only: false })}>
            Disable Read-only
          </Button>
        </div>
      </div>

      {(isSuperAdmin || user?.role === "clinic-admin") && (
        <div className="rounded-xl border bg-white p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Mobile workflow — letterhead & QR</h2>
          <p className="text-sm text-gray-600">
            Upload assets to Supabase Storage; staff apps load signed URLs for overlays and payment QR.
          </p>
          {workflowMsg ? <p className="text-sm text-blue-700">{workflowMsg}</p> : null}
          <div className="flex flex-wrap gap-4">
            <label className="text-sm font-medium text-gray-800">
              Letterhead (PDF/PNG)
              <input
                type="file"
                accept="image/*,application/pdf"
                className="block mt-1 text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAsset("letterhead", f).catch((err) => setWorkflowMsg(String(err.message)));
                }}
              />
            </label>
            <label className="text-sm font-medium text-gray-800">
              Payment QR
              <input
                type="file"
                accept="image/*"
                className="block mt-1 text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAsset("payment_qr", f).catch((err) => setWorkflowMsg(String(err.message)));
                }}
              />
            </label>
          </div>
          {isSuperAdmin ? (
            <div className="grid gap-3 sm:grid-cols-2 border-t pt-4">
              <div>
                <Label>Max doctors (empty = unlimited)</Label>
                <Input value={maxDoctors} onChange={(e) => setMaxDoctors(e.target.value)} placeholder="e.g. 5" />
              </div>
              <div>
                <Label>Max receptionists (empty = unlimited)</Label>
                <Input value={maxReceptionists} onChange={(e) => setMaxReceptionists(e.target.value)} placeholder="e.g. 3" />
              </div>
              <div className="sm:col-span-2">
                <Button type="button" variant="secondary" onClick={() => void saveCaps()}>
                  Save caps
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {isSuperAdmin && receptionists.length > 0 && doctors.length > 0 ? (
        <div className="rounded-xl border bg-white p-4 sm:p-6 space-y-3 overflow-x-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Receptionist ↔ doctor access</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => void saveAssignments()}>
              Save matrix
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Receptionists only see patients and appointments for doctors they are assigned to.
          </p>
          <table className="w-full text-sm min-w-[480px] border-collapse">
            <thead>
              <tr>
                <th className="border p-2 text-left">Receptionist</th>
                {doctors.map((d) => (
                  <th key={d.id} className="border p-2 text-left whitespace-nowrap">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receptionists.map((r) => (
                <tr key={r.id}>
                  <td className="border p-2 font-medium">{r.name}</td>
                  {doctors.map((d) => {
                    const on = assignRows.some((p) => p.receptionist_user_id === r.id && p.doctor_user_id === d.id);
                    return (
                      <td key={d.id} className="border p-2 text-center">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleAssignment(r.id, d.id)}
                          aria-label={`${r.name} — ${d.name}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Staff (doctors and receptionists)</h2>
          <Button variant="outline" size="sm" onClick={() => void fetchStaff()} disabled={loading}>
            Refresh staff
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          Portal login uses <span className="font-mono font-semibold">User ID</span>. Passwords are only shown once when a user is created unless you generate a new one.
        </p>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">User ID (login)</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-gray-500">
                    No users linked to this clinic yet. Add them from Users.
                  </td>
                </tr>
              ) : (
                staff.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-900">{row.name}</td>
                    <td className="py-2 pr-3 capitalize">{row.role.replace("-", " ")}</td>
                    <td className="py-2 pr-3 font-mono text-xs sm:text-sm break-all">{row.user_id}</td>
                    <td className="py-2 pr-3">{row.phone || "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={row.is_active ? "default" : "secondary"}>
                        {row.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                      {(row.role === "doctor" || row.role === "independent") && isSuperAdmin ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void openDoctorKyc(row)}>
                          <Eye className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">KYC</span>
                        </Button>
                      ) : null}
                      {isSuperAdmin ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => setResetUserId(row.id)}>
                          <KeyRound className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">New password</span>
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={kycOpen} onOpenChange={setKycOpen}>
        <DialogContent className="max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Doctor KYC — {kycDoctorName}</DialogTitle>
            <DialogDescription>
              PAN, Aadhaar, and signature open in a new tab (signed URLs).
            </DialogDescription>
          </DialogHeader>
          {kycLoading ? (
            <p className="text-sm text-gray-600">Loading documents…</p>
          ) : (
            <div className="space-y-4">
              {kycLicense ? (
                <div className="rounded-lg border p-3 text-sm">
                  <span className="font-semibold">License number: </span>
                  <span className="font-mono">{kycLicense}</span>
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {["pan", "aadhaar", "signature"].map((key) => {
                  const d = kycDocs?.[key];
                  const label = key === "aadhaar" ? "Aadhaar" : key === "pan" ? "PAN" : "Signature";
                  return (
                    <div key={key} className="rounded-lg border p-3">
                      <div className="text-sm font-semibold mb-2">{label}</div>
                      {d?.signedUrl ? (
                        <a
                          className="text-sm text-blue-600 underline break-all"
                          href={d.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open document
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500">Not on file</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setKycOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUserId} onOpenChange={(o) => !o && setResetUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate new password?</DialogTitle>
            <DialogDescription>
              This invalidates the old password. The new password is shown once in the next step.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setResetUserId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void resetPassword()} disabled={loading}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newCreds} onOpenChange={(o) => !o && setNewCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New credentials</DialogTitle>
            <DialogDescription>Copy now — the password will not be shown again.</DialogDescription>
          </DialogHeader>
          {newCreds ? (
            <div className="font-mono text-sm space-y-1 break-all">
              <div>
                <span className="text-gray-600">user_id: </span>
                {newCreds.user_id}
              </div>
              <div>
                <span className="text-gray-600">password: </span>
                {newCreds.password}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={() => setNewCreds(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
