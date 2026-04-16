import { Link } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import QueueList from "@/components/QueueList";
import ActivePatientPanel from "@/components/ActivePatientPanel";
import ReportsTab from "@/components/ReportsTab";

export default function DoctorReportsPage() {
  const { user } = useAdminAuth();
  const {
    clinicId,
    loading,
    error,
    rows,
    selectedAppointmentId,
    handleSelectPatient,
    activePatient,
    selectedAppt,
    clinicLetterhead,
  } = useDoctorPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Diagnostic Reports</h1>
        <p className="text-sm text-gray-500">Upload and review patient reports for the selected visit</p>
      </div>

      {!clinicId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          No clinic is assigned to this account. Ask your admin to link this user to a clinic in{" "}
          <span className="font-semibold">Admin → Users</span> so the queue and patients load.
        </div>
      )}

      {clinicId && !loading && !error && rows.length === 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg text-sm">
          No patients in the queue yet. When reception checks in a patient for this clinic, they will appear here.
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-1 order-2 lg:order-1">
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
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs sm:text-sm text-blue-900">
                You are on the diagnostic reports page for this visit.
              </p>
              <Link
                to="/doctor-dashboard/queue"
                className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                Open prescription page
              </Link>
            </div>
          )}

          {activePatient && selectedAppt && clinicId ? (
            <ReportsTab
              patientId={activePatient.id}
              patientName={activePatient.name}
              clinicId={clinicId}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
              Select a patient from queue to view or upload diagnostic reports.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
