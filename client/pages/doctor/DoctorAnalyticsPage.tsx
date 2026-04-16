import { Link } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import ReportsTab from "@/components/ReportsTab";
import { BarChart3 } from "lucide-react";

export default function DoctorAnalyticsPage() {
  const { clinicId, activePatient, selectedAppt } = useDoctorPortal();

  const canShowReports = !!(activePatient && selectedAppt && clinicId);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">Diagnostic reports for the active patient</p>
      </div>

      {!canShowReports && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">No patient selected</p>
          <p className="mt-1 text-sm text-gray-600">
            Open the queue and select a patient to view diagnostic reports here.
          </p>
          <Link
            to="/doctor-dashboard/queue"
            className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Go to queue
          </Link>
        </div>
      )}

      {canShowReports && activePatient && clinicId && (
        <ReportsTab
          patientId={activePatient.id}
          patientName={activePatient.name}
          clinicId={clinicId}
        />
      )}
    </div>
  );
}
