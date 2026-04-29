import { Link } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { BarChart3, Users, FileText } from "lucide-react";

export default function DoctorAnalyticsPage() {
  const { clinicId, rows, recentConsultations, recentLoading } = useDoctorPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">
          Quick counts for today. Prescriptions and diagnostic uploads are managed from the queue page.
        </p>
      </div>

      {!clinicId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          No clinic is assigned to this account. Ask your admin to link this user to a clinic in{" "}
          <span className="font-semibold">Admin → Users</span>.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Patients in queue</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{rows.length}</p>
            </div>
            <Users className="h-10 w-10 text-blue-600 opacity-20" />
          </div>
          <Link
            to="/doctor-dashboard/queue"
            className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Open queue
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Recent consultations loaded</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {recentLoading ? "…" : recentConsultations.length}
              </p>
            </div>
            <BarChart3 className="h-10 w-10 text-emerald-600 opacity-20" />
          </div>
          <Link
            to="/doctor-dashboard/prescriptions"
            className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Prescription history
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-3">
            <FileText className="h-8 w-8 text-amber-600 opacity-80 shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">Diagnostic reports</p>
              <p className="mt-1 text-sm text-gray-600">
                Upload scans and labs (and attach the prescription file) from the queue after you select a patient.
              </p>
              <Link
                to="/doctor-dashboard/queue#visit-reports"
                className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Go to queue — reports section
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
