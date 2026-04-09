import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
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
import { apiFetch, apiErrorMessage, apiUrl, getAccessToken } from "@/lib/api-base";

export default function AdminClinics() {
  const navigate = useNavigate();
  const { tokens, user } = useAdminAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [createLetterheadFile, setCreateLetterheadFile] = useState<File | null>(null);

  type FilterKey = "all" | "new" | "live" | "suspended" | "payment_due";
  const [filter, setFilter] = useState<FilterKey>("all");

  const matchesFilter = useCallback((clinic: Record<string, unknown>, key: FilterKey) => {
    const status = String(clinic.subscription_status || "").toLowerCase();
    const created = clinic.created_at ? new Date(String(clinic.created_at)).getTime() : 0;
    const fourteenDays = 14 * 86400000;
    const isNewSignup = Date.now() - created < fourteenDays;
    const exp = clinic.subscription_expires_at
      ? new Date(String(clinic.subscription_expires_at)).getTime()
      : null;
    const expired =
      exp != null && !Number.isNaN(exp) && exp < Date.now();

    if (key === "all") return true;
    if (key === "new") return status === "pending" || isNewSignup;
    if (key === "live")
      return status === "live" && !expired;
    if (key === "suspended") return status === "suspended";
    if (key === "payment_due")
      return status === "payment_due" || (status === "live" && expired);
    return true;
  }, []);

  const filteredClinics = useMemo(
    () => clinics.filter((c) => matchesFilter(c as Record<string, unknown>, filter)),
    [clinics, filter, matchesFilter]
  );

  const recordSaasPayment = async (clinicId: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}/saas-payment`, {
        method: "POST",
        headers,
        body: JSON.stringify({ months: 1 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json));
      await fetchClinics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  const headers = useMemo(() => {
    const accessToken = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }, [tokens?.accessToken]);

  const fetchClinics = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/clinics", { headers });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json));
      setClinics(json.clinics || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clinics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewClinic = (clinicId: string) => {
    navigate(`/admin-dashboard/clinic/${clinicId}`);
  };

  const createClinic = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/clinics", {
        method: "POST",
        headers,
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json));

      // Optional: upload letterhead immediately after clinic creation.
      if (createLetterheadFile && json.clinic?.id) {
        const fd = new FormData();
        fd.append("kind", "letterhead");
        fd.append("file", createLetterheadFile);
        const token = getAccessToken();
        const upRes = await fetch(apiUrl(`/api/admin/clinics/${json.clinic.id}/clinic-asset`), {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const upJson = await upRes.json().catch(() => ({}));
        if (!upRes.ok || !upJson.success) {
          throw new Error(apiErrorMessage(upJson) || "Clinic created, but letterhead upload failed");
        }
      }

      setCreateOpen(false);
      setCreateForm({ name: "", email: "", phone: "", address: "" });
      setCreateLetterheadFile(null);
      await fetchClinics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create clinic");
    } finally {
      setLoading(false);
    }
  };

  const setClinicStatus = async (clinicId: string, subscription_status: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ subscription_status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json));
      await fetchClinics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update clinic");
    } finally {
      setLoading(false);
    }
  };

  const deactivateClinic = async (clinicId: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/clinics/${clinicId}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(apiErrorMessage(json));
      await fetchClinics();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to deactivate clinic");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {isSuperAdmin ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Add New Clinic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Clinic</DialogTitle>
              <DialogDescription>
                Clinic code will be generated automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="clinic-name">Clinic Name</Label>
                <Input
                  id="clinic-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clinic-email">Email</Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clinic-phone">Phone</Label>
                <Input
                  id="clinic-phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clinic-address">Address</Label>
                <Input
                  id="clinic-address"
                  value={createForm.address}
                  onChange={(e) => setCreateForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clinic-letterhead">Letterhead (optional)</Label>
                <Input
                  id="clinic-letterhead"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCreateLetterheadFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-gray-500">
                  Upload JPG/PNG now so this clinic is ready for receptionist/doctor letterhead workflow.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={createClinic} disabled={loading || !createForm.name.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        ) : (
          <div className="text-sm text-gray-600">Your clinic</div>
        )}

        <Button variant="outline" onClick={fetchClinics} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-600 mr-2">Filter:</span>
        {(
          [
            ["all", "All"],
            ["new", "New"],
            ["live", "Live"],
            ["suspended", "Suspended"],
            ["payment_due", "Payment due"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {loading && clinics.length === 0 ? (
          <div className="text-sm text-gray-600">Loading clinics...</div>
        ) : null}
        {filteredClinics.map((clinic) => (
          <div key={clinic.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 rounded-lg p-3">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {clinic.name}{" "}
                    <span className="ml-2 font-mono text-xs text-gray-500">{clinic.clinic_code}</span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{clinic.address}</p>
                  <p className="text-sm text-gray-600">{clinic.phone}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{clinic.subscription_status || clinic.status || "unknown"}</Badge>
                    {clinic.subscription_expires_at ? (
                      <span className="text-xs text-gray-500">
                        Expires {new Date(clinic.subscription_expires_at).toLocaleDateString("en-IN")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {isSuperAdmin ? (
                  <>
                    {clinic.subscription_status === "suspended" ||
                    clinic.subscription_status === "inactive" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recordSaasPayment(clinic.id)}
                        disabled={loading}
                      >
                        Record payment & activate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClinicStatus(clinic.id, "suspended")}
                        disabled={loading}
                      >
                        Suspend
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deactivateClinic(clinic.id)} disabled={loading}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deactivate
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 items-center">
              <div>
                <p className="text-xs text-gray-600 font-semibold">Inactive Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{clinic.inactiveUsersCount || 0}</p>
              </div>
              <div className="text-right flex gap-2 justify-end items-start">
                <button
                  onClick={() => handleViewClinic(clinic.id)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

