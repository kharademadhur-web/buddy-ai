import { useMemo, useState, useEffect, useCallback } from "react";
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
import { FileText, Download, Printer, CheckCircle2, Loader2, KeyRound, Phone, Building2, Hash, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DoctorRecentConsultation = {
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

  // Clinic letterhead for patient panel + metadata for Settings
  const [clinicLetterhead, setClinicLetterhead] = useState<import("@/context/ClinicContext").Letterhead | null>(null);
  const [clinicMeta, setClinicMeta] = useState<{ name: string; phone?: string | null; address?: string | null } | null>(null);
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
              clinicName: j.clinic?.name ?? "Clinic",
              clinicAddress: j.clinic?.address ?? "",
              clinicPhone: j.clinic?.phone ?? "",
              createdAt: new Date(),
            });
          }
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
      scroll("staff-prescription-history");
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
      reloadRecentConsultations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      <Sidebar role="doctor" queueCount={rows.length} />

      <div className="flex-1 overflow-y-auto min-h-0 w-full min-w-0 pt-14 md:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-2 mb-6 sm:mb-8">
            {user?.name ? (
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900">{user.name}</h1>
            ) : (
              <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
            )}
            <p className="text-sm sm:text-base text-gray-500">Doctor Dashboard</p>
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

          {clinicId && (
            <Card id="staff-prescription-history" className="mb-6 scroll-mt-24 border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Recent prescriptions
                </CardTitle>
                <CardDescription>
                  Medicines and notes from completed visits (by patient). Use the sidebar &quot;Prescriptions&quot; to jump
                  here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading history…
                  </div>
                ) : recentConsultations.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">
                    No completed consultations yet. When you finish a visit with medicines or notes, they will appear
                    here.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          <th className="px-3 py-2 whitespace-nowrap">Date</th>
                          <th className="px-3 py-2 whitespace-nowrap">Patient</th>
                          <th className="px-3 py-2 whitespace-nowrap">Phone</th>
                          <th className="px-3 py-2 min-w-[200px]">Medicines</th>
                          <th className="px-3 py-2 min-w-[120px]">Notes / diagnosis</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recentConsultations.map((c) => {
                          const dt = c.createdAt ? new Date(c.createdAt) : null;
                          const medSummary =
                            c.prescription?.items?.length ?
                              c.prescription.items
                                .map((it) => [it.name, it.dosage, it.frequency].filter(Boolean).join(" · "))
                                .join("; ")
                            : "—";
                          const extra = c.diagnosis || c.notes || c.prescription?.notes || "—";
                          return (
                            <tr key={c.consultationId} className="bg-white hover:bg-gray-50/80">
                              <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                {dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : "—"}
                              </td>
                              <td className="px-3 py-2 font-medium text-gray-900">{c.patient?.name ?? "—"}</td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                {c.patient?.phone ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-800">{medSummary}</td>
                              <td className="px-3 py-2 text-gray-600 max-w-md truncate" title={extra}>
                                {extra}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card id="staff-settings" className="mb-6 scroll-mt-24 border-gray-200 shadow-sm">
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
                    <p className="text-sm font-semibold text-gray-900">{clinicMeta?.name ?? clinicLetterhead?.clinicName ?? "—"}</p>
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
      </div>
    </div>
  );
}
