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
  summaryLoading: boolean;
  refetchSummary: () => Promise<void>;
  paymentQrUrl: string | null;
  clinicMeta: { name: string; phone?: string | null; address?: string | null; clinicCode?: string | null } | null;
  onlineDoctors: Array<{ id: string; name: string }>;
  offlineDoctors: Array<{ id: string; name: string }>;
};

const ReceptionPortalContext = createContext<ReceptionPortalContextValue | null>(null);

export function ReceptionPortalProvider({ children }: { children: ReactNode }) {
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id ?? null;
  const { queue, patientsById, loading, error, refetch } = useQueueAndPatients(clinicId);
  const { summary, loading: summaryLoading, refetch: refetchSummary } = useBillingSummary(clinicId);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [clinicMeta, setClinicMeta] = useState<{
    name: string;
    phone?: string | null;
    address?: string | null;
    clinicCode?: string | null;
  } | null>(null);
  const [onlineDoctors, setOnlineDoctors] = useState<Array<{ id: string; name: string }>>([]);
  const [offlineDoctors, setOfflineDoctors] = useState<Array<{ id: string; name: string }>>([]);

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
          setClinicMeta({
            name: j.clinic?.name ?? "Clinic",
            phone: j.clinic?.phone ?? null,
            address: j.clinic?.address ?? null,
            clinicCode: j.clinic?.clinic_code ?? null,
          });
        }
      } catch {
        setPaymentQrUrl(null);
      }
    })();
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    const loadDoctorPresence = async () => {
      try {
        const res = await apiFetch(`/api/staff/doctors?clinicId=${encodeURIComponent(clinicId)}`);
        const j = await res.json();
        if (!res.ok || !j.success) return;
        const on = (j.onlineDoctors || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
        const off = (j.offlineDoctors || []).map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
        if (on.length > 0 || off.length > 0) {
          setOnlineDoctors(on);
          setOfflineDoctors(off);
          return;
        }
        const raw = (j.doctors || []) as Array<{ id: string; name: string; online?: boolean }>;
        setOnlineDoctors(raw.filter((d) => d.online).map((d) => ({ id: d.id, name: d.name })));
        setOfflineDoctors(raw.filter((d) => !d.online).map((d) => ({ id: d.id, name: d.name })));
      } catch {
        /* non-fatal */
      }
    };
    void loadDoctorPresence();
    const t = setInterval(() => void loadDoctorPresence(), 10000);
    return () => clearInterval(t);
  }, [clinicId]);

  const value: ReceptionPortalContextValue = {
    clinicId,
    queue,
    patientsById,
    loading,
    error,
    refetch,
    summary,
    summaryLoading,
    refetchSummary,
    paymentQrUrl,
    clinicMeta,
    onlineDoctors,
    offlineDoctors,
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
