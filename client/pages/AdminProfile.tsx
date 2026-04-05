import React, { useState, useEffect } from "react";
import { useClinic } from "@/context/ClinicContext";
import { Loader2, Lock, Unlock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

      const response = await fetch(`/api/clinic-access/${clinicId}`, {
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
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Profile</h1>
          <p className="text-gray-600 mt-1">
            Manage clinic access and payment status
          </p>
        </div>
      </div>

      {/* Clinic Access Control Section */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Clinic Access Control
          </h2>

          {clinicAccess.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No clinics available
            </p>
          ) : (
            <div className="space-y-4">
              {clinicAccess.map((clinic) => (
                <div
                  key={clinic._id}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {clinic.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{clinic.email}</p>

                    {clinic.readOnlyMode && (
                      <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
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

                  <div className="ml-4 flex flex-col gap-2">
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
                        className="text-xs border border-gray-300 rounded px-2 py-1 w-48"
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
