import { Link } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import ReportsTab from "@/components/ReportsTab";

export default function DoctorReportsPage() {
  const {
    clinicId,
    error,
    activePatient,
    selectedAppt,
  } = useDoctorPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Diagnostic Reports</h1>
        <p className="text-sm text-gray-500">
          Upload and review patient reports for the selected visit. Prescription writing remains on the queue page.
        </p>
      </div>

      {!clinicId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          No clinic is assigned to this account. Ask your admin to link this user to a clinic in{" "}
          <span className="font-semibold">Admin → Users</span> so the queue and patients load.
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>
      )}

      {!activePatient || !selectedAppt || !clinicId ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
          Select a patient first from the queue/prescription page, then open Reports for upload and review.
          <div className="mt-3">
            <Link
              to="/doctor-dashboard/queue"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Open prescription page
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs sm:text-sm text-blue-900">
              Current visit: <span className="font-semibold">{activePatient.name}</span>
            </p>
            <Link
              to="/doctor-dashboard/queue"
              className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              Open prescription page
            </Link>
          </div>
          <ReportsTab patientId={activePatient.id} patientName={activePatient.name} clinicId={clinicId} />
        </div>
      )}
    </div>
  );
}
