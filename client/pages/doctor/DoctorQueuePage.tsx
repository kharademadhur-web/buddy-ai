import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Link } from "react-router-dom";
import QueueList from "@/components/QueueList";
import ActivePatientPanel from "@/components/ActivePatientPanel";
import PrescriptionCanvas from "@/components/PrescriptionCanvas";
import MedicineTable from "@/components/MedicineTable";
import { FileText, Download, Printer, CheckCircle2, Loader2 } from "lucide-react";

export default function DoctorQueuePage() {
  const { user } = useAdminAuth();
  const {
    clinicId,
    loading,
    error,
    refetch,
    rows,
    selectedAppointmentId,
    handleSelectPatient,
    activePatient,
    selectedAppt,
    prescriptionNotes,
    setPrescriptionNotes,
    medicines,
    setMedicines,
    completing,
    handleGeneratePrescription,
    clinicLetterhead,
    setVoiceSession,
    voiceTranscript,
    voiceEnglishPhrase,
  } = useDoctorPortal();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Queue</h1>
        <p className="text-sm text-gray-500">Live queue and active consultation</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-1 order-2 lg:order-1">
          <QueueList
            rows={rows}
            onPatientSelect={handleSelectPatient}
            selectedAppointmentId={selectedAppointmentId || undefined}
            loading={loading}
          />
        </div>

        <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1 lg:order-2">
          <ActivePatientPanel
            patient={activePatient}
            doctorName={user?.name}
            letterhead={clinicLetterhead}
            clinicId={clinicId}
            allowNameEdit={true}
            onPatientNameUpdated={() => {
              void refetch();
            }}
          />

          {activePatient && selectedAppt && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs sm:text-sm text-blue-900">
                You are on the prescription page for this visit.
              </p>
              <Link
                to="/doctor-dashboard/reports"
                className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                Open diagnostic reports page
              </Link>
            </div>
          )}

          {activePatient && selectedAppt && (
            <div className="space-y-5">
              {selectedAppt.chief_complaint ? (
                <div className="rounded-2xl border-2 border-blue-100 bg-gradient-to-br from-blue-50/90 to-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Patient description (from intake)</p>
                  <p className="mt-2 text-base text-gray-900 leading-relaxed">{selectedAppt.chief_complaint}</p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-1">Visit documentation</h3>
                <p className="text-xs text-gray-500 mb-4">Brief notes, voice conversation, and English summary — handwriting is optional.</p>
                <PrescriptionCanvas
                  key={selectedAppointmentId ?? "none"}
                  value={prescriptionNotes}
                  onChange={setPrescriptionNotes}
                  isRecording={false}
                  showHandwriting={false}
                  onVoiceOutput={setVoiceSession}
                />
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-4 sm:p-6 shadow-sm">
                <h4 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-700" />
                  Medicines
                </h4>
                <p className="text-xs text-gray-600 mb-4">
                  Search NIH RxNorm + clinic list; optional Google Custom Search when configured on the server.
                </p>
                <MedicineTable medicines={medicines} onChange={setMedicines} editable={true} />
              </div>

              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 sm:p-6 shadow-sm">
                <h4 className="text-base font-bold text-gray-900 mb-2">Doctor and patient short conversation</h4>
                <p className="text-xs text-gray-600 mb-3">
                  This short line is saved at the end of the prescription. It comes from voice summary.
                </p>
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Short summary</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {voiceEnglishPhrase?.trim() || "No short summary yet. Use voice recording and Stop & summarize."}
                  </p>
                </div>
                {voiceTranscript?.trim() ? (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Conversation transcript</p>
                    <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap max-h-28 overflow-y-auto">
                      {voiceTranscript}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  <Printer className="w-5 h-5" />
                  Print
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePrescription}
                  disabled={completing}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-colors"
                >
                  {completing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  Complete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
