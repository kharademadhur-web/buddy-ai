import { useEffect, useMemo, useState } from "react";
import { PlusCircle, RefreshCw, ToggleRight } from "lucide-react";
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

type CreateUserRole = "doctor" | "receptionist";

export default function AdminUsers() {
  const { tokens, user } = useAdminAuth();
  const canToggleUserActive = user?.role === "super-admin";
  const [users, setUsers] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    user_id: string;
    password: string;
  } | null>(null);

  const [createForm, setCreateForm] = useState<{
    name: string;
    phone: string;
    email: string;
    role: CreateUserRole;
    clinic_id: string;
    clinic_code: string;
    license_number: string;
    send_credentials_to: "sms" | "email" | "none";
  }>({
    name: "",
    phone: "",
    email: "",
    role: "doctor",
    clinic_id: "",
    clinic_code: "",
    license_number: "",
    send_credentials_to: "none",
  });

  const headers = useMemo(() => {
    const accessToken = tokens?.accessToken || sessionStorage.getItem("admin_access_token") || "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }, [tokens?.accessToken]);

  const fetchClinics = async () => {
    const res = await apiFetch("/api/admin/clinics", { headers });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load clinics");
    setClinics(json.clinics || []);
  };

  const fetchUsers = async () => {
    const res = await apiFetch("/api/admin/users", { headers });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(apiErrorMessage(json) || "Failed to load users");
    setUsers(json.users || []);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchClinics(), fetchUsers()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createUser = async () => {
    setLoading(true);
    setError("");
    setCreatedCredentials(null);
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        headers,
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
      setCreateForm((p) => ({
        ...p,
        name: "",
        phone: "",
        email: "",
        license_number: "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const clinicById = useMemo(() => {
    const m: Record<string, { name?: string; clinic_code?: string }> = {};
    for (const c of clinics) m[c.id] = c;
    return m;
  }, [clinics]);

  const subForUser = (u: any) => {
    const c = u.clinics;
    const row = Array.isArray(c) ? c[0] : c;
    return row as
      | {
          subscription_status?: string;
          subscription_started_at?: string | null;
          subscription_expires_at?: string | null;
        }
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
        headers,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Add New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Create doctor/receptionist users under a clinic. Credentials are shown once.
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
              <div className="grid gap-2">
                <Label>Clinic</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={createForm.clinic_id}
                  onChange={(e) => {
                    const clinicId = e.target.value;
                    const clinic = clinics.find((c) => c.id === clinicId);
                    setCreateForm((p) => ({
                      ...p,
                      clinic_id: clinicId,
                      clinic_code: clinic?.clinic_code || "",
                    }));
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

              <div className="grid gap-2">
                <Label>Role</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, role: e.target.value as CreateUserRole }))
                  }
                >
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              {createForm.role === "doctor" ? (
                <div className="grid gap-2">
                  <Label htmlFor="license">License number *</Label>
                  <Input
                    id="license"
                    value={createForm.license_number}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, license_number: e.target.value }))
                    }
                  />
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label>Send credentials to</Label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={createForm.send_credentials_to}
                  onChange={(e) =>
                    setCreateForm((p) => ({
                      ...p,
                      send_credentials_to: e.target.value as any,
                    }))
                  }
                >
                  <option value="none">Don’t send (show on screen)</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={createUser}
                disabled={
                  loading ||
                  !createForm.clinic_id ||
                  !createForm.name.trim() ||
                  !createForm.phone.trim() ||
                  (createForm.role === "doctor" && !createForm.license_number.trim())
                }
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button variant="outline" onClick={refreshAll} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Name
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Role
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Clinic
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Subscription
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Start
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Expiry
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Days left
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Created
                </th>
                <th className="px-6 py-4 text-left font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-4 text-center font-semibold text-gray-700">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const sub = subForUser(user);
                const cc = user.clinic_id ? clinicById[user.clinic_id] : undefined;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {user.name}
                      <div className="font-mono text-xs text-gray-500 font-normal">{user.user_id}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 capitalize">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 text-gray-700 text-sm">
                      {cc ? (
                        <>
                          <div>{cc.name}</div>
                          <div className="font-mono text-xs text-gray-500">{cc.clinic_code}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="text-xs">
                        {sub?.subscription_status ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {sub?.subscription_started_at
                        ? new Date(sub.subscription_started_at).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {sub?.subscription_expires_at
                        ? new Date(sub.subscription_expires_at).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-700 text-sm">
                      {daysLeft(sub?.subscription_expires_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.is_active ? "secondary" : "outline"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        className="text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                        disabled={loading || !canToggleUserActive}
                        onClick={() => toggleActive(user.id, Boolean(user.is_active))}
                        title={canToggleUserActive ? "Toggle active" : "Only super admin can toggle"}
                        type="button"
                      >
                        <ToggleRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
