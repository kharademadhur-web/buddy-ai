import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { useNavigate } from "react-router-dom";
import QueueList from "@/components/QueueList";

export default function DoctorQueuePage() {
  const navigate = useNavigate();
  const { clinicId, loading, error, rows } = useDoctorPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Queue</h1>
        <p className="text-sm text-gray-500">Open any patient to view the full prescription and reports workspace.</p>
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

      <QueueList
        rows={rows}
        onPatientSelect={(_patientId, appointmentId) => {
          navigate(`/doctor-dashboard/queue/${appointmentId}`);
        }}
        loading={loading}
      />
    </div>
  );
}
