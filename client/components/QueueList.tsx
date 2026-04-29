import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Patient } from "@/context/ClinicContext";
import { queueStatusLabel } from "@/lib/queue-display";

export interface QueueRow {
  appointmentId: string;
  patient: Patient;
}

interface QueueListProps {
  rows: QueueRow[];
  onPatientSelect?: (patientId: string, appointmentId: string) => void;
  /** Prefer this for highlight when multiple rows share the same patient. */
  selectedAppointmentId?: string;
  selectedPatientId?: string;
  loading?: boolean;
  emptyMessage?: string;
}

export default function QueueList({
  rows,
  onPatientSelect,
  selectedAppointmentId,
  selectedPatientId,
  loading,
  emptyMessage = "No patients in queue",
}: QueueListProps) {
  const statusConfig = {
    waiting: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    active: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100" },
    done: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Queue</h2>
          {loading && (
            <span className="text-xs text-gray-500">Updating…</span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {rows.length} patient{rows.length !== 1 ? "s" : ""} in queue
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {rows.length > 0 ? (
          rows.map((row) => {
            const patient = row.patient;
            const StatusIcon = statusConfig[patient.status].icon;

            return (
              <div
                key={row.appointmentId}
                className={cn(
                  "w-full p-4 text-left transition-colors hover:bg-gray-50",
                  (selectedAppointmentId === row.appointmentId ||
                    (!selectedAppointmentId && selectedPatientId === patient.id)) &&
                    "bg-blue-50 border-l-4 border-blue-600"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onPatientSelect?.(patient.id, row.appointmentId)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-gray-600">
                        Token #{patient.token}
                      </span>
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-700">
                        {patient.age} yrs
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{patient.phone}</p>
                    {patient.symptoms && (
                      <p className="text-xs text-gray-500 mt-2">
                        Complaint: {patient.symptoms}
                      </p>
                    )}
                  </button>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        "text-[10px] font-bold tracking-wide px-2 py-0.5 rounded",
                        statusConfig[patient.status].bg,
                        statusConfig[patient.status].color
                      )}
                    >
                      {queueStatusLabel(patient.status)}
                    </span>
                    <div
                      className={cn(
                        "rounded-full p-2",
                        statusConfig[patient.status].bg
                      )}
                    >
                      <StatusIcon
                        className={cn(
                          "w-5 h-5",
                          statusConfig[patient.status].color
                        )}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onPatientSelect?.(patient.id, row.appointmentId)}
                      className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
