import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useQueueAndPatients, useBillingSummary } from "@/hooks/useClinicWorkflow";
import { apiFetch } from "@/lib/api-base";

type ReceptionPortalContextValue = {
  clinicId: string | null;
  queue: ReturnType<typeof useQueueAndPatients>["queue"];
  patientsById: ReturnType<typeof useQueueAndPatients>["patientsById"];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  summary: ReturnType<typeof useBillingSummary>["summary"];
  refetchSummary: () => Promise<void>;
  paymentQrUrl: string | null;
};

const ReceptionPortalContext = createContext<ReceptionPortalContextValue | null>(null);

export function ReceptionPortalProvider({ children }: { children: ReactNode }) {
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id ?? null;
  const { queue, patientsById, loading, error, refetch } = useQueueAndPatients(clinicId);
  const { summary, refetch: refetchSummary } = useBillingSummary(clinicId);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    void (async () => {
      try {
        const res = await apiFetch(
          `/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(clinicId)}`
        );
        const j = await res.json();
        if (res.ok && j.success) {
          setPaymentQrUrl(j.paymentQrSignedUrl || null);
        }
      } catch {
        setPaymentQrUrl(null);
      }
    })();
  }, [clinicId]);

  const value: ReceptionPortalContextValue = {
    clinicId,
    queue,
    patientsById,
    loading,
    error,
    refetch,
    summary,
    refetchSummary,
    paymentQrUrl,
  };

  return (
    <ReceptionPortalContext.Provider value={value}>{children}</ReceptionPortalContext.Provider>
  );
}

export function useReceptionPortal() {
  const ctx = useContext(ReceptionPortalContext);
  if (!ctx) throw new Error("useReceptionPortal must be used within ReceptionPortalProvider");
  return ctx;
}
