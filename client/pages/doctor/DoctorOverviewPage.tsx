import { Link } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { Users, ArrowRight, Stethoscope } from "lucide-react";

export default function DoctorOverviewPage() {
  const { user, clinicId, queue, loading, error, rows } = useDoctorPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        {user?.name ? (
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900">{user.name}</h1>
        ) : (
          <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
        )}
        <p className="text-sm sm:text-base text-gray-500">Overview</p>
      </div>

      {!clinicId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          No clinic is assigned to this account. Ask your admin to link this user to a clinic in{" "}
          <span className="font-semibold">Admin → Users</span> so the queue and patients load.
        </div>
      )}

      {clinicId && !loading && !error && queue.length === 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg text-sm">
          No patients in the queue yet. When reception checks in a patient for this clinic, they will appear in the
          queue.
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>
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
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Open queue
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:col-span-2 lg:col-span-2">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <Stethoscope className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Today&apos;s workflow</p>
              <p className="mt-1 text-sm text-gray-600">
                Select a patient from the queue to start a consultation, write prescriptions, and complete the visit.
                Recent prescription history and account settings live on their own pages in the sidebar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
