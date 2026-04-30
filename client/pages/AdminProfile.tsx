import React, { useState, useEffect } from "react";
import { useClinic } from "@/context/ClinicContext";
import { Loader2, Lock, Unlock, AlertCircle, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api-base";

interface ClinicAccess {
  _id: string;
  name: string;
  email: string;
  phone: string;
  readOnlyMode: boolean;
  readOnlyReason?: string;
}

export default function AdminProfile() {
  const { clinics } = useClinic();
  const [clinicAccess, setClinicAccess] = useState<ClinicAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  useEffect(() => {
    // Initialize clinic access data from context
    setClinicAccess(
      clinics.map((clinic: any) => ({
        _id: clinic.id,
        name: clinic.name,
        email: clinic.email,
        phone: clinic.phone,
        readOnlyMode: clinic.readOnlyMode || false,
        readOnlyReason: clinic.readOnlyReason || "",
      }))
    );
    setLoading(false);
  }, [clinics]);

  const handleToggleAccess = async (
    clinicId: string,
    currentMode: boolean
  ) => {
    try {
      setToggling((prev) => ({
        ...prev,
        [clinicId]: true,
      }));

      const newMode = !currentMode;
      const clinicReason = reason[clinicId] || "";

      const response = await fetch(apiUrl(`/api/clinic-access/${clinicId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          readOnlyMode: newMode,
          readOnlyReason: newMode ? clinicReason : null,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to update access");
      }

      // Update local state
      setClinicAccess((prev) =>
        prev.map((clinic) =>
          clinic._id === clinicId
            ? {
                ...clinic,
                readOnlyMode: newMode,
                readOnlyReason: clinicReason,
              }
            : clinic
        )
      );

      toast.success(
        `Clinic access ${newMode ? "disabled" : "enabled"} successfully`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update access"
      );
    } finally {
      setToggling((prev) => ({
        ...prev,
        [clinicId]: false,
      }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Admin Profile</h1>
          <p className="mt-1 text-text-secondary">
            Manage clinic access and payment status
          </p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Clinic Access Control Section */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-text-primary">
            Clinic Access Control
          </h2>

          {clinicAccess.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface py-8 text-center text-text-secondary">
              No clinics available
            </p>
          ) : (
            <div className="space-y-4">
              {clinicAccess.map((clinic) => (
                <div
                  key={clinic._id}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-1 hover:shadow-md sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1">
                    <h3 className="mb-1 font-semibold text-text-primary">
                      {clinic.name}
                    </h3>
                    <p className="mb-2 text-sm text-text-secondary">{clinic.email}</p>

                    {clinic.readOnlyMode && (
                      <div className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3 text-sm text-text-primary">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Access Disabled</p>
                          {clinic.readOnlyReason && (
                            <p className="text-xs mt-1">{clinic.readOnlyReason}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:ml-4">
                    {clinic.readOnlyMode && !toggling[clinic._id] && (
                      <input
                        type="text"
                        placeholder="Enter reason"
                        value={reason[clinic._id] || clinic.readOnlyReason || ""}
                        onChange={(e) => {
                          setReason((prev) => ({
                            ...prev,
                            [clinic._id]: e.target.value,
                          }));
                        }}
                        className="w-48 rounded-xl border-2 border-border bg-card px-3 py-2 text-xs"
                      />
                    )}

                    <Button
                      onClick={() =>
                        handleToggleAccess(clinic._id, clinic.readOnlyMode)
                      }
                      disabled={toggling[clinic._id]}
                      variant={clinic.readOnlyMode ? "outline" : "destructive"}
                      className="flex items-center gap-2"
                    >
                      {toggling[clinic._id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : clinic.readOnlyMode ? (
                        <>
                          <Unlock className="w-4 h-4" />
                          Enable Access
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          Disable Access
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
