import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";

export default function DoctorReportsPage() {
  const navigate = useNavigate();
  const {
    clinicId,
    error,
    activePatient,
    selectedAppt,
  } = useDoctorPortal();

  useEffect(() => {
    if (activePatient && selectedAppt && clinicId) {
      navigate("/doctor-dashboard/queue#visit-reports", { replace: true });
    }
  }, [activePatient?.id, selectedAppt?.id, clinicId, navigate]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Diagnostics</h1>
        <p className="text-sm text-gray-500">
          Reports for the active visit now live on the queue page with the prescription, so intake details and uploads stay in one place.
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

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
        Select a patient from the queue, then scroll to <span className="font-semibold">Diagnostic reports</span> on that page to upload X-rays, labs, or attach the prescription file.
        <div className="mt-3">
          <Link
            to="/doctor-dashboard/queue#visit-reports"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Open queue (diagnostics section)
          </Link>
        </div>
      </div>
    </div>
  );
}
