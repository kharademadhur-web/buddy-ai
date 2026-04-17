import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useQueueAndPatients } from "@/hooks/useClinicWorkflow";
import { appointmentToPatient } from "@/lib/queue-ui";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";
import type { HandwritingStrokeBundle } from "@shared/handwriting";
import type { LetterheadFieldMap } from "@shared/api";
import type { QueueRow } from "@/components/QueueList";
import type { Letterhead } from "@/context/ClinicContext";
import { Medicine } from "@/context/ClinicContext";
import { toast } from "sonner";

export type DoctorRecentConsultation = {
  consultationId: string;
  createdAt: string;
  diagnosis: string | null;
  notes: string | null;
  patient: { id?: string; name?: string; phone: string | null };
  prescription: {
    id: string;
    notes: string | null;
    createdAt: string;
    items: Array<{
      name: string;
      dosage: string | null;
      frequency: string | null;
      duration: string | null;
    }>;
  } | null;
};

type DoctorPortalContextValue = {
  user: ReturnType<typeof useAdminAuth>["user"];
  clinicId: string | null;
  queue: ReturnType<typeof useQueueAndPatients>["queue"];
  patientsById: ReturnType<typeof useQueueAndPatients>["patientsById"];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  rows: QueueRow[];
  selectedAppointmentId: string | null;
  setSelectedAppointmentId: (id: string | null) => void;
  selectedAppt: ReturnType<typeof useQueueAndPatients>["queue"][number] | null;
  activePatient: QueueRow["patient"] | null;
  handleSelectPatient: (patientId: string, appointmentId: string) => Promise<void>;
  prescriptionNotes: string;
  setPrescriptionNotes: (v: string) => void;
  handwritingStrokes: HandwritingStrokeBundle | null;
  setHandwritingStrokes: (v: HandwritingStrokeBundle | null) => void;
  medicines: Medicine[];
  setMedicines: (v: Medicine[] | ((prev: Medicine[]) => Medicine[])) => void;
  completing: boolean;
  handleGeneratePrescription: () => Promise<void>;
  clinicLetterhead: Letterhead | null;
  clinicLetterheadFieldMap: LetterheadFieldMap;
  clinicMeta: { name: string; phone?: string | null; address?: string | null } | null;
  recentConsultations: DoctorRecentConsultation[];
  recentLoading: boolean;
  reloadRecentConsultations: () => void;
  uploadPersonalQr: (file: File) => Promise<void>;
  qrUploading: boolean;
  /** Loaded from server; null until first fetch completes */
  acceptingPatients: boolean | null;
  setAcceptingPatients: (next: boolean) => Promise<void>;
  availabilitySaving: boolean;
  /** Voice conversation + English phrase from Stop & summarize */
  voiceTranscript: string;
  voiceEnglishPhrase: string;
  setVoiceSession: (o: { transcript: string; englishPhrase: string }) => void;
};

const DoctorPortalContext = createContext<DoctorPortalContextValue | null>(null);

export function DoctorPortalProvider({ children }: { children: ReactNode }) {
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id ?? null;
  const { queue, patientsById, loading, error, refetch } = useQueueAndPatients(clinicId, {
    doctorUserId: user?.id ?? null,
  });

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [handwritingStrokes, setHandwritingStrokes] = useState<HandwritingStrokeBundle | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [completing, setCompleting] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceEnglishPhrase, setVoiceEnglishPhrase] = useState("");

  const setVoiceSession = useCallback((o: { transcript: string; englishPhrase: string }) => {
    setVoiceTranscript(o.transcript);
    setVoiceEnglishPhrase(o.englishPhrase);
  }, []);

  const [clinicLetterhead, setClinicLetterhead] = useState<Letterhead | null>(null);
  const [clinicLetterheadFieldMap, setClinicLetterheadFieldMap] = useState<LetterheadFieldMap>({});
  const [clinicMeta, setClinicMeta] = useState<{
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    apiFetch(`/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(clinicId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.clinic) {
          setClinicMeta({
            name: j.clinic.name ?? "Clinic",
            phone: j.clinic.phone ?? null,
            address: j.clinic.address ?? null,
          });
          if (j.letterhead?.signedUrl) {
            setClinicLetterhead({
              id: clinicId,
              name: j.clinic?.name ?? "Clinic",
              templateUrl: j.letterhead.signedUrl,
              mime: j.letterhead?.mime ?? undefined,
              clinicName: j.clinic?.name ?? "Clinic",
              clinicAddress: j.clinic?.address ?? "",
              clinicPhone: j.clinic?.phone ?? "",
              createdAt: new Date(),
            });
          }
          setClinicLetterheadFieldMap((j.letterhead?.fieldMap as LetterheadFieldMap | undefined) || {});
        }
      })
      .catch(() => {});
  }, [clinicId]);

  const [recentConsultations, setRecentConsultations] = useState<DoctorRecentConsultation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const reloadRecentConsultations = useCallback(() => {
    if (!clinicId || !user?.id) return;
    setRecentLoading(true);
    apiFetch(`/api/consultations/doctor/recent?clinicId=${encodeURIComponent(clinicId)}&limit=50`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.consultations)) setRecentConsultations(j.consultations);
      })
      .catch(() => setRecentConsultations([]))
      .finally(() => setRecentLoading(false));
  }, [clinicId, user?.id]);

  useEffect(() => {
    reloadRecentConsultations();
  }, [reloadRecentConsultations]);

  const [qrUploading, setQrUploading] = useState(false);

  const [acceptingPatients, setAcceptingPatientsState] = useState<boolean | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== "doctor" && user.role !== "independent")) return;
    void apiFetch("/api/staff/me/portal-availability")
      .then((r) => r.json())
      .then((j: { success?: boolean; acceptingPatients?: boolean }) => {
        if (j.success && typeof j.acceptingPatients === "boolean") {
          setAcceptingPatientsState(j.acceptingPatients);
        } else {
          setAcceptingPatientsState(true);
        }
      })
      .catch(() => setAcceptingPatientsState(true));
  }, [user?.id, user?.role]);

  const setAcceptingPatients = useCallback(async (next: boolean) => {
    setAvailabilitySaving(true);
    try {
      const res = await apiFetch("/api/staff/me/portal-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptingPatients: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(j) || "Could not update availability");
      setAcceptingPatientsState(typeof j.acceptingPatients === "boolean" ? j.acceptingPatients : next);
      if (next) {
        void apiFetch("/api/staff/presence-heartbeat", { method: "POST" });
      }
      toast.success(next ? "You appear online to reception" : "You appear offline to reception");
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "Update failed"));
    } finally {
      setAvailabilitySaving(false);
    }
  }, []);

  useEffect(() => {
    if (!user || (user.role !== "doctor" && user.role !== "independent")) return;
    if (acceptingPatients !== true) return;
    const tick = () => {
      void apiFetch("/api/staff/presence-heartbeat", { method: "POST" });
    };
    tick();
    const t = setInterval(tick, 45_000);
    return () => clearInterval(t);
  }, [user?.role, user?.id, acceptingPatients]);

  const uploadPersonalQr = async (file: File) => {
    setQrUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/staff/me/payment-qr", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j) || "Upload failed");
      toast.success("Personal payment QR saved.");
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "Upload failed"));
    } finally {
      setQrUploading(false);
    }
  };

  const rows: QueueRow[] = useMemo(() => {
    return queue.map((appt, i) => ({
      appointmentId: appt.id,
      patient: appointmentToPatient(appt, patientsById[appt.patient_id], i + 1),
    }));
  }, [queue, patientsById]);

  const selectedAppt = useMemo(
    () => queue.find((a) => a.id === selectedAppointmentId) ?? null,
    [queue, selectedAppointmentId]
  );

  const selectedRow = useMemo(
    () => rows.find((r) => r.appointmentId === selectedAppointmentId) ?? null,
    [rows, selectedAppointmentId]
  );

  const activePatient = selectedRow?.patient ?? null;

  const handleSelectPatient = async (_patientId: string, appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setPrescriptionNotes("");
    setHandwritingStrokes(null);
    setMedicines([]);
    setVoiceTranscript("");
    setVoiceEnglishPhrase("");
    const appt = queue.find((a) => a.id === appointmentId);
    if (appt?.status === "checked_in" && clinicId) {
      try {
        await apiFetch(`/api/appointments/${appointmentId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "in_consultation" }),
        });
        await refetch();
      } catch {
        // Queue refetch on interval will reconcile
      }
    }
  };

  const handleGeneratePrescription = async () => {
    if (!activePatient || !selectedAppt || !clinicId || !user?.id) return;

    setCompleting(true);
    try {
      const body: Record<string, unknown> = {
        clinicId,
        appointmentId: selectedAppt.id,
        patientId: selectedAppt.patient_id,
        diagnosis: prescriptionNotes || undefined,
        notes: prescriptionNotes || undefined,
      };
      if (handwritingStrokes && handwritingStrokes.lines.length > 0) {
        body.handwritingStrokes = handwritingStrokes;
      }
      if (medicines.length > 0) {
        body.prescription = {
          notes: prescriptionNotes || undefined,
          items: medicines.map((m) => ({
            name: m.name,
            dosage: m.dosage || undefined,
            frequency: m.frequency || undefined,
            duration: m.duration || undefined,
          })),
        };
      }
      if (voiceTranscript.trim()) {
        body.aiTranscript = voiceTranscript.trim();
      }
      if (voiceEnglishPhrase.trim()) {
        body.aiSummary = voiceEnglishPhrase.trim();
      }
      if (voiceTranscript.trim() || voiceEnglishPhrase.trim()) {
        body.recordingConsent = true;
      }

      const res = await apiFetch("/api/consultations/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(j) || "Failed to complete consultation");

      toast.success("Consultation completed");
      setSelectedAppointmentId(null);
      setPrescriptionNotes("");
      setHandwritingStrokes(null);
      setMedicines([]);
      setVoiceTranscript("");
      setVoiceEnglishPhrase("");
      await refetch();
      reloadRecentConsultations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete");
    } finally {
      setCompleting(false);
    }
  };

  const value: DoctorPortalContextValue = {
    user,
    clinicId,
    queue,
    patientsById,
    loading,
    error,
    refetch,
    rows,
    selectedAppointmentId,
    setSelectedAppointmentId,
    selectedAppt,
    activePatient,
    handleSelectPatient,
    prescriptionNotes,
    setPrescriptionNotes,
    handwritingStrokes,
    setHandwritingStrokes,
    medicines,
    setMedicines,
    completing,
    handleGeneratePrescription,
    clinicLetterhead,
    clinicLetterheadFieldMap,
    clinicMeta,
    recentConsultations,
    recentLoading,
    reloadRecentConsultations,
    uploadPersonalQr,
    qrUploading,
    acceptingPatients,
    setAcceptingPatients,
    availabilitySaving,
    voiceTranscript,
    voiceEnglishPhrase,
    setVoiceSession,
  };

  return <DoctorPortalContext.Provider value={value}>{children}</DoctorPortalContext.Provider>;
}

export function useDoctorPortal() {
  const ctx = useContext(DoctorPortalContext);
  if (!ctx) throw new Error("useDoctorPortal must be used within DoctorPortalProvider");
  return ctx;
}
