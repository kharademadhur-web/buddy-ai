import { useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useQueueAndPatients } from "@/hooks/useClinicWorkflow";
import { appointmentToPatient } from "@/lib/queue-ui";
import { apiFetch } from "@/lib/api-base";
import Sidebar from "@/components/Sidebar";
import QueueList, { type QueueRow } from "@/components/QueueList";
import ActivePatientPanel from "@/components/ActivePatientPanel";
import PrescriptionCanvas from "@/components/PrescriptionCanvas";
import MedicineTable from "@/components/MedicineTable";
import ReportsTab from "@/components/ReportsTab";
import { Medicine } from "@/context/ClinicContext";
import { FileText, Download, Printer, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function DoctorDashboard() {
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id ?? null;
  const { queue, patientsById, loading, error, refetch } = useQueueAndPatients(clinicId, {
    doctorUserId: user?.id,
  });

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [activeTab, setActiveTab] = useState<"prescription" | "reports">("prescription");
  const [completing, setCompleting] = useState(false);

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
      if (!res.ok) throw new Error(j.error || "Failed to complete consultation");

      toast.success("Consultation completed");
      setSelectedAppointmentId(null);
      setPrescriptionNotes("");
      setMedicines([]);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role="doctor" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Doctor Dashboard</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <QueueList
                rows={rows}
                onPatientSelect={handleSelectPatient}
                selectedAppointmentId={selectedAppointmentId || undefined}
                loading={loading}
              />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <ActivePatientPanel
                patient={activePatient}
                doctorName={user?.name}
                letterhead={null}
              />

              {activePatient && selectedAppt && (
                <>
                  <div className="flex gap-2 border-b border-gray-200 mb-6">
                    <button
                      type="button"
                      onClick={() => setActiveTab("prescription")}
                      className={cn(
                        "px-4 py-3 font-semibold transition-colors border-b-2",
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
                        "px-4 py-3 font-semibold transition-colors border-b-2",
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Clinical Notes & Prescription
                  </h3>

                  <div className="mb-6">
                    <PrescriptionCanvas
                      value={prescriptionNotes}
                      onChange={setPrescriptionNotes}
                      isRecording={false}
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
                <ReportsTab
                  patientId={activePatient.id}
                  patientName={activePatient.name}
                  clinicId={clinicId}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
