import { useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useQueueAndPatients, useBillingSummary } from "@/hooks/useClinicWorkflow";
import { appointmentToPatient } from "@/lib/queue-ui";
import Sidebar from "@/components/Sidebar";
import QueueList, { type QueueRow } from "@/components/QueueList";
import PatientForm from "@/components/PatientForm";
import { Users, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function ReceptionDashboard() {
  const { user } = useAdminAuth();
  const clinicId = user?.clinic_id ?? null;
  const { queue, patientsById, loading, error, refetch } = useQueueAndPatients(clinicId);
  const { summary, refetch: refetchSummary } = useBillingSummary(clinicId);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const rows: QueueRow[] = useMemo(() => {
    return queue.map((appt, i) => ({
      appointmentId: appt.id,
      patient: appointmentToPatient(appt, patientsById[appt.patient_id], i + 1),
    }));
  }, [queue, patientsById]);

  const completedToday = summary?.completedToday ?? 0;
  const totalCollected = summary?.totalCollected ?? 0;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role="reception" />

      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Reception Dashboard</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Patients in Queue</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{queue.length}</p>
                </div>
                <Users className="w-12 h-12 text-blue-600 opacity-10" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Completed Today</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{completedToday}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-600 opacity-10" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Collected Today (paid)</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">₹{totalCollected}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-600 opacity-10" />
              </div>
            </div>
          </div>

          <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="text-center md:text-left flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Payments & OTP</h2>
              <p className="text-sm text-gray-600 mt-1">
                UPI / QR for collections. OTP contact:{" "}
                <a
                  className="text-blue-600 font-medium"
                  href={`tel:+91${import.meta.env.VITE_OTP_PHONE || "9137295344"}`}
                >
                  +91 {import.meta.env.VITE_OTP_PHONE || "9137295344"}
                </a>
              </p>
            </div>
            <div className="shrink-0">
              <img
                src={import.meta.env.VITE_PAYMENT_QR_URL || "/payment-qr.png"}
                alt="Payment QR"
                className="w-40 h-40 rounded-lg border border-gray-200 bg-white object-contain"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <PatientForm
                onSuccess={() => {
                  toast.success("Patient registered and checked in");
                  void refetch();
                  void refetchSummary();
                }}
              />
            </div>

            <div className="lg:col-span-2">
              <QueueList
                rows={rows}
                onPatientSelect={(_pid, aid) => setSelectedAppointmentId(aid)}
                selectedAppointmentId={selectedAppointmentId || undefined}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
