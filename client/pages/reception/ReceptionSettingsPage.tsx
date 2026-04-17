import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useReceptionPortal } from "@/context/ReceptionPortalContext";
import { Button } from "@/components/ui/button";
import PortalChangePasswordDialog from "@/components/PortalChangePasswordDialog";
import { KeyRound, Hash, UserCircle, Phone, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReceptionSettingsPage() {
  const { user } = useAdminAuth();
  const { clinicMeta } = useReceptionPortal();
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Account and security</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setPwOpen(true)}>
          <KeyRound className="h-4 w-4" />
          Change password
        </Button>
      </div>

      <PortalChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>Your profile and clinic</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              <UserCircle className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500">Your name</p>
                <p className="text-sm font-semibold text-gray-900">{user?.name ?? "—"}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              <Phone className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500">Phone</p>
                <p className="text-sm font-semibold text-gray-900">{user?.phone?.trim() || "—"}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              <Hash className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500">User ID</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{user?.user_id ?? "—"}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              <Building2 className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500">Clinic</p>
                <p className="text-sm font-semibold text-gray-900">{clinicMeta?.name || "—"}</p>
                {user?.clinic_code ? (
                  <p className="text-xs text-gray-500 mt-0.5">ID: <span className="font-mono">{user.clinic_code}</span></p>
                ) : null}
                {clinicMeta?.phone ? <p className="text-xs text-gray-500 mt-0.5">Phone: {clinicMeta.phone}</p> : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
