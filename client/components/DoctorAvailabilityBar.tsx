import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorAvailabilityBar() {
  const { acceptingPatients, setAcceptingPatients, availabilitySaving } = useDoctorPortal();

  if (acceptingPatients === null) {
    return (
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Loading availability…
      </div>
    );
  }

  const online = acceptingPatients === true;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm",
        online ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-gray-50"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
            online ? "bg-emerald-500" : "bg-red-500"
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-medium text-gray-900">
            {online ? "Online for reception" : "Offline for reception"}
          </p>
          <p className="text-xs text-gray-600">
            Reception sees you in the doctor list when you are online and this portal is open.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {availabilitySaving ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
        <Label htmlFor="portal-accepting" className="text-sm text-gray-700 cursor-pointer">
          Accepting patients
        </Label>
        <Switch
          id="portal-accepting"
          checked={online}
          disabled={availabilitySaving}
          onCheckedChange={(checked) => void setAcceptingPatients(checked)}
        />
      </div>
    </div>
  );
}
