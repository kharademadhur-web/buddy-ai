import { format } from "date-fns";
import { Phone, Calendar, Stethoscope, User } from "lucide-react";
import { Patient, Letterhead } from "@/context/ClinicContext";
import { queueStatusLabel } from "@/lib/queue-display";

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

  const hasLetterhead = Boolean(letterhead?.templateUrl);
  const isPdfLetterhead = String(letterhead?.mime || "").toLowerCase().includes("pdf");

  return (
    <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ── Letterhead background (clinic branding) ── */}
      <div className="relative w-full">
        {hasLetterhead && !isPdfLetterhead ? (
          <>
            {/* Actual letterhead image as background */}
            <img
              src={letterhead!.templateUrl}
              alt="Clinic letterhead"
              className="w-full object-cover max-h-52"
            />
            {/* Semi-transparent overlay so text is readable */}
            <div className="absolute inset-0 bg-black/30" />
          </>
        ) : (
          <div
            className="w-full min-h-32"
            style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)" }}
          />
        )}

        {/* Clinic name + doctor + date — always rendered on top of the image */}
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="text-white">
            <h1 className="text-xl font-bold leading-tight drop-shadow">
              {letterhead?.clinicName || "Clinic"}
            </h1>
            {letterhead?.clinicAddress && (
              <p className="text-xs opacity-90 mt-0.5">{letterhead.clinicAddress}</p>
            )}
            {letterhead?.clinicPhone && (
              <p className="text-xs opacity-90">{letterhead.clinicPhone}</p>
            )}
            {hasLetterhead && isPdfLetterhead ? (
              <a
                href={letterhead?.templateUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 rounded bg-white/20 px-2 py-1 text-[11px] font-semibold hover:bg-white/30"
              >
                Open letterhead PDF
              </a>
            ) : null}
          </div>
          <div className="flex items-end justify-between text-white">
            <div>
              <p className="text-xs opacity-80">Consulting Doctor</p>
              <p className="text-base font-semibold drop-shadow">
                {doctorName || letterhead?.doctorName || "Doctor"}
              </p>
              {letterhead?.specialization && (
                <p className="text-xs opacity-75">{letterhead.specialization}</p>
              )}
            </div>
            <div className="text-right text-xs opacity-90">
              <p>{format(new Date(), "dd MMM yyyy")}</p>
              <p>{format(new Date(), "hh:mm a")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Patient info filled by receptionist ── */}
      <div className="bg-white p-5 space-y-4">
        {/* Header row: name + token */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">{patient.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Age: <strong>{patient.age}</strong> yrs</span>
              </div>
              {(patient as any).gender && (
                <span className="capitalize">Sex: <strong>{(patient as any).gender}</strong></span>
              )}
              <div className="flex items-center gap-1">
                <Phone className="w-4 h-4" />
                <span>{patient.phone}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Token</p>
            <p className="text-3xl font-bold text-blue-600">#{patient.token}</p>
          </div>
        </div>

        {/* Chief complaint / disease — written by receptionist */}
        {patient.symptoms && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
              Chief Complaint (filled by Reception)
            </p>
            <p className="text-gray-800 text-sm leading-relaxed">{patient.symptoms}</p>
          </div>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status:</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              patient.status === "active"
                ? "bg-blue-100 text-blue-700"
                : patient.status === "done"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {queueStatusLabel(patient.status)}
          </span>
        </div>
      </div>
    </div>
  );
}
