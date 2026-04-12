import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";
import PortalChangePasswordDialog from "@/components/PortalChangePasswordDialog";
import { useQueueAndPatients } from "@/hooks/useClinicWorkflow";
import { appointmentToPatient } from "@/lib/queue-ui";
import { apiFetch, apiErrorMessage, errorMessageFromUnknown } from "@/lib/api-base";
import type { HandwritingStrokeBundle } from "@/components/PrescriptionCanvas";
import Sidebar from "@/components/Sidebar";
import QueueList, { type QueueRow } from "@/components/QueueList";
import ActivePatientPanel from "@/components/ActivePatientPanel";
import PrescriptionCanvas from "@/components/PrescriptionCanvas";
import MedicineTable from "@/components/MedicineTable";
import ReportsTab from "@/components/ReportsTab";
import { Medicine } from "@/context/ClinicContext";
import { FileText, Download, Printer, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function DoctorDashboard() {
  const location = useLocation();
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id ?? null;
  const { queue, patientsById, loading, error, refetch } = useQueueAndPatients(clinicId, {
    doctorUserId: user?.id ?? null,
  });

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [handwritingStrokes, setHandwritingStrokes] = useState<HandwritingStrokeBundle | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [activeTab, setActiveTab] = useState<"prescription" | "reports">("prescription");
  const [completing, setCompleting] = useState(false);

  // Clinic letterhead for patient panel
  const [clinicLetterhead, setClinicLetterhead] = useState<import("@/context/ClinicContext").Letterhead | null>(null);
  useEffect(() => {
    if (!clinicId) return;
    apiFetch(`/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(clinicId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.letterhead?.signedUrl) {
          setClinicLetterhead({
            id: clinicId,
            name: j.clinic?.name ?? "Clinic",
            templateUrl: j.letterhead.signedUrl,
            clinicName: j.clinic?.name ?? "Clinic",
            clinicAddress: j.clinic?.address ?? "",
            clinicPhone: j.clinic?.phone ?? "",
            createdAt: new Date(),
          });
        }
      })
      .catch(() => {});
  }, [clinicId]);

  const [pwOpen, setPwOpen] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== "doctor" && user.role !== "independent")) return;
    const tick = () => {
      void apiFetch("/api/staff/presence-heartbeat", { method: "POST" });
    };
    tick();
    const t = setInterval(tick, 45_000);
    return () => clearInterval(t);
  }, [user?.role, user?.id]);

  // Sidebar links: /doctor-dashboard#queue | #rx | #analytics | #settings
  useEffect(() => {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    const h = raw.toLowerCase();
    const scroll = (id: string) =>
      window.requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    if (h === "queue") scroll("staff-queue");
    if (h === "rx" || h === "prescription") {
      setActiveTab("prescription");
      scroll("staff-prescription");
    }
    if (h === "analytics" || h === "reports") {
      setActiveTab("reports");
      scroll("staff-reports");
    }
    if (h === "settings") scroll("staff-settings");
  }, [location.hash]);

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

  const handleSelectPatient = async (patientId: string, appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setPrescriptionNotes("");
    setHandwritingStrokes(null);
    setMedicines([]);
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
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      <Sidebar role="doctor" />

      <div className="flex-1 overflow-y-auto min-h-0 w-full min-w-0 pt-14 md:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
              {user?.name ? (
                <p className="mt-1 text-sm text-gray-600">
                  Signed in as <span className="font-medium text-gray-800">{user.name}</span>
                  {user.user_id ? (
                    <span className="ml-2 font-mono text-xs text-gray-500">{user.user_id}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
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
                  Your UPI QR
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                id="staff-settings"
                onClick={() => setPwOpen(true)}
              >
                <KeyRound className="h-4 w-4" />
                Change password
              </Button>
            </div>
          </div>

          <PortalChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />

          {!clinicId && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              No clinic is assigned to this account. Ask your admin to link this user to a clinic in{" "}
              <span className="font-semibold">Admin → Users</span> so the queue and patients load.
            </div>
          )}

          {clinicId && !loading && !error && queue.length === 0 && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg text-sm">
              No patients in the queue yet. When reception checks in a patient for this clinic, they will
              appear here.
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            <div id="staff-queue" className="lg:col-span-1 order-2 lg:order-1 scroll-mt-24">
              <QueueList
                rows={rows}
                onPatientSelect={handleSelectPatient}
                selectedAppointmentId={selectedAppointmentId || undefined}
                loading={loading}
              />
            </div>

            <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1 lg:order-2">
              <ActivePatientPanel
                patient={activePatient}
                doctorName={user?.name}
                letterhead={clinicLetterhead}
              />

              {activePatient && selectedAppt && (
                <>
                  <div className="flex gap-2 border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTab("prescription")}
                      className={cn(
                        "px-3 sm:px-4 py-2 sm:py-3 font-semibold transition-colors border-b-2 whitespace-nowrap",
                        activeTab === "prescription"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-600 border-transparent hover:text-gray-900"
                      )}
                    >
                      Prescription
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("reports")}
                      className={cn(
                        "px-3 sm:px-4 py-2 sm:py-3 font-semibold transition-colors border-b-2 whitespace-nowrap",
                        activeTab === "reports"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-600 border-transparent hover:text-gray-900"
                      )}
                    >
                      Diagnostic Reports
                    </button>
                  </div>
                </>
              )}

              {activePatient && selectedAppt && activeTab === "prescription" && (
                <div
                  id="staff-prescription"
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 scroll-mt-24"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Clinical Notes & Prescription
                  </h3>

                  <div className="mb-6">
                    <PrescriptionCanvas
                      key={selectedAppointmentId ?? "none"}
                      value={prescriptionNotes}
                      onChange={setPrescriptionNotes}
                      isRecording={false}
                      onHandwritingChange={setHandwritingStrokes}
                    />
                  </div>

                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Medicines
                    </h4>
                    <MedicineTable
                      medicines={medicines}
                      onChange={setMedicines}
                      editable={true}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                    >
                      <Printer className="w-5 h-5" />
                      Print
                    </button>
                    <button
                      type="button"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      Export
                    </button>
                    <button
                      type="button"
                      onClick={handleGeneratePrescription}
                      disabled={completing}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-colors"
                    >
                      {completing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                      Complete
                    </button>
                  </div>
                </div>
              )}

              {activePatient && selectedAppt && activeTab === "reports" && clinicId && (
                <div id="staff-reports" className="scroll-mt-24">
                  <ReportsTab
                    patientId={activePatient.id}
                    patientName={activePatient.name}
                    clinicId={clinicId}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
