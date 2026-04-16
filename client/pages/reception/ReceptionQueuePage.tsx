import { useMemo, useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useReceptionPortal } from "@/context/ReceptionPortalContext";
import { appointmentToPatient } from "@/lib/queue-ui";
import QueueList, { type QueueRow } from "@/components/QueueList";

export default function ReceptionQueuePage() {
  const { user } = useAdminAuth();
  const { clinicId, queue, patientsById, loading, error } = useReceptionPortal();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const rows: QueueRow[] = useMemo(() => {
    return queue.map((appt, i) => ({
      appointmentId: appt.id,
      patient: appointmentToPatient(appt, patientsById[appt.patient_id], i + 1),
    }));
  }, [queue, patientsById]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Queue</h1>
        <p className="mt-1 text-sm text-gray-600">
          {user?.name ? (
            <>
              Signed in as <span className="font-medium text-gray-800">{user.name}</span>
            </>
          ) : (
            "Live waiting list"
          )}
        </p>
      </div>

      {!clinicId && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          No clinic is assigned to this account. Contact your administrator to attach this user to a clinic.
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">{error}</div>
      )}

      <QueueList
        rows={rows}
        onPatientSelect={(_pid, aid) => setSelectedAppointmentId(aid)}
        selectedAppointmentId={selectedAppointmentId || undefined}
        loading={loading}
      />
    </div>
  );
}
