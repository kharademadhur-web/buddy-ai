import { useState } from "react";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { Button } from "@/components/ui/button";
import PortalChangePasswordDialog from "@/components/PortalChangePasswordDialog";
import { KeyRound, Loader2, Phone, Building2, Hash, UserCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DoctorSettingsPage() {
  const { user, clinicLetterhead, clinicMeta, uploadPersonalQr, qrUploading } = useDoctorPortal();
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Account, clinic, and security</p>
      </div>

      <PortalChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Account &amp; clinic</CardTitle>
          <CardDescription>Your profile, clinic identifiers, and security</CardDescription>
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
                <p className="text-xs font-medium text-gray-500">Phone (onboarding)</p>
                <p className="text-sm font-semibold text-gray-900">{user?.phone?.trim() || "—"}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              <Hash className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500">Your user ID</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{user?.user_id ?? "—"}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
              <Building2 className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500">Clinic</p>
                <p className="text-sm font-semibold text-gray-900">
                  {clinicMeta?.name ?? clinicLetterhead?.clinicName ?? "—"}
                </p>
                {user?.clinic_code ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Clinic ID: <span className="font-mono">{user.clinic_code}</span>
                  </p>
                ) : null}
                {clinicMeta?.phone ? (
                  <p className="text-xs text-gray-500 mt-0.5">Clinic phone: {clinicMeta.phone}</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {(user?.role === "doctor" || user?.role === "independent") && (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm cursor-pointer hover:bg-gray-50">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={qrUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadPersonalQr(f);
                  }}
                />
                {qrUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Upload your UPI QR
              </label>
            )}
            <Button type="button" variant="outline" className="gap-2" onClick={() => setPwOpen(true)}>
              <KeyRound className="h-4 w-4" />
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
