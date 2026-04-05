import { format } from "date-fns";
import { Phone, Calendar, Stethoscope } from "lucide-react";
import { Patient, Letterhead } from "@/context/ClinicContext";

interface ActivePatientPanelProps {
  patient: Patient | null;
  doctorName?: string;
  letterhead?: Letterhead | null;
}

export default function ActivePatientPanel({
  patient,
  doctorName = "Doctor",
  letterhead,
}: ActivePatientPanelProps) {
  if (!patient) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-semibold">
          Select a patient to begin consultation
        </p>
      </div>
    );
  }

  const activeLetterhead = letterhead ?? null;

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div
        className="relative w-full bg-cover bg-no-repeat p-8 min-h-96 flex flex-col justify-between"
        style={{
          background: activeLetterhead
            ? activeLetterhead.templateUrl
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/10"></div>

        <div className="relative z-10 text-white mb-8">
          <h1 className="text-3xl font-bold">
            {activeLetterhead?.clinicName || "Clinic"}
          </h1>
          {activeLetterhead?.registrationNumber && (
            <p className="text-sm opacity-90 mt-1">
              Reg. No: {activeLetterhead.registrationNumber}
            </p>
          )}
          <p className="text-sm opacity-90 mt-1">
            {activeLetterhead?.clinicAddress || ""}
          </p>
          <p className="text-sm opacity-90">
            {activeLetterhead?.clinicPhone || ""}
          </p>
        </div>

        <div className="relative z-10 text-white border-t border-white/30 pt-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm opacity-90">Doctor:</p>
              <p className="text-xl font-semibold">
                {doctorName || activeLetterhead?.doctorName || "Doctor"}
              </p>
              {activeLetterhead?.specialization && (
                <p className="text-xs opacity-75 mt-1">
                  {activeLetterhead.specialization}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs opacity-90">Date:</p>
              <p className="text-sm opacity-90">
                {format(new Date(), "dd MMM yyyy")}
              </p>
              <p className="text-xs opacity-90">
                {format(new Date(), "hh:mm a")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 space-y-4">
        <div className="flex items-start justify-between pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Age: {patient.age} years
              </div>
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {patient.phone}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 font-semibold">Token #</p>
            <p className="text-3xl font-bold text-blue-600">{patient.token}</p>
          </div>
        </div>

        {patient.symptoms && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Chief Complaints
            </p>
            <p className="text-gray-700 bg-gray-50 rounded-lg p-3 text-sm">
              {patient.symptoms}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Status:</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              patient.status === "active"
                ? "bg-blue-100 text-blue-700"
                : patient.status === "done"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
