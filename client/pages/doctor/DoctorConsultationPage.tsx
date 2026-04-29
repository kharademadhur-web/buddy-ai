import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import type { Letterhead } from "@/context/ClinicContext";
import QueueList from "@/components/QueueList";
import ActivePatientPanel from "@/components/ActivePatientPanel";
import PrescriptionCanvas from "@/components/PrescriptionCanvas";
import MedicineTable from "@/components/MedicineTable";
import ReportsTab from "@/components/ReportsTab";
import { apiErrorMessage, apiUrl, errorMessageFromUnknown } from "@/lib/api-base";
import { buildPrescriptionHtml as buildPrescriptionLetterheadHtml } from "@/lib/prescription-letterhead";
import { toast } from "sonner";
import { FileText, Download, Printer, CheckCircle2, Loader2, Upload } from "lucide-react";

export default function DoctorConsultationPage() {
  const { appointmentId = "" } = useParams<{ appointmentId: string }>();
  const { user, tokens } = useAdminAuth();
  const location = useLocation();
  const [reportsReloadKey, setReportsReloadKey] = useState(0);
  const [attachingReport, setAttachingReport] = useState(false);
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
    setHandwritingStrokes,
    medicines,
    setMedicines,
    completing,
    handleGeneratePrescription,
    clinicLetterhead,
    clinicLetterheadFieldMap,
    clinicMeta,
    setVoiceSession,
    voiceTranscript,
    voiceEnglishPhrase,
    refreshClinicLetterhead,
  } = useDoctorPortal();

  useEffect(() => {
    if (!appointmentId || loading || rows.length === 0 || selectedAppointmentId === appointmentId) return;
    const row = rows.find((r) => r.appointmentId === appointmentId);
    if (!row) return;
    void handleSelectPatient(row.patient.id, row.appointmentId);
  }, [appointmentId, rows, loading, selectedAppointmentId, handleSelectPatient]);

  useEffect(() => {
    if (location.hash.replace(/^#/, "") !== "visit-reports") return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById("visit-reports")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location.hash, activePatient?.id, selectedAppt?.id]);

  const existsInQueue = useMemo(() => rows.some((r) => r.appointmentId === appointmentId), [rows, appointmentId]);

  const buildPrescriptionHtml = (letterheadOverride?: Letterhead | null) => {
    const patientName = activePatient?.name || "Patient";
    const patientPhone = activePatient?.phone || "—";
    const patientAge = activePatient?.age ? `${activePatient.age}` : "—";
    const visitDate = new Date().toLocaleString();
    const doctorName = user?.name || "Doctor";
    const complaint = selectedAppt?.chief_complaint || "—";
    const notes = prescriptionNotes || "—";
    const summary = voiceEnglishPhrase?.trim() || "";
    return buildPrescriptionLetterheadHtml({
      clinicLetterhead: letterheadOverride === undefined ? clinicLetterhead : letterheadOverride,
      fieldMap: clinicLetterheadFieldMap,
      clinicMeta,
      patient: {
        name: patientName,
        phone: patientPhone,
        age: patientAge,
        gender: (activePatient as { gender?: string | null } | null)?.gender ?? null,
        token: activePatient?.token,
      },
      doctorName,
      visitDateText: visitDate,
      complaint,
      notes,
      summary,
      medicines: medicines || [],
    });
  };

  const toDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const buildPrescriptionHtmlForOutput = async () => {
    const latestLetterhead = await refreshClinicLetterhead();
    const source = latestLetterhead ?? clinicLetterhead;
    if (!source?.templateUrl || String(source.mime || "").toLowerCase().includes("pdf")) {
      return buildPrescriptionHtml(source);
    }
    const embeddedUrl = await toDataUrl(source.templateUrl);
    return buildPrescriptionHtml(
      embeddedUrl ? { ...source, templateUrl: embeddedUrl } : source
    );
  };

  const handlePrintPrescription = async () => {
    const html = await buildPrescriptionHtmlForOutput();
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleExportPrescriptionHtml = async () => {
    const html = await buildPrescriptionHtmlForOutput();
    const safeName = (activePatient?.name || "patient").replace(/[^a-z0-9_-]+/gi, "_");
    const dateToken = new Date().toISOString().slice(0, 10);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription_${safeName}_${dateToken}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleAttachPrescriptionToReports = async () => {
    if (!activePatient || !clinicId) return;
    if (!tokens?.accessToken) {
      toast.error("Not authenticated.");
      return;
    }
    setAttachingReport(true);
    try {
      const html = await buildPrescriptionHtmlForOutput();
      const safeName = (activePatient.name || "patient").replace(/[^a-z0-9_-]+/gi, "_");
      const dateToken = new Date().toISOString().slice(0, 10);
      const file = new File([html], `prescription_${safeName}_${dateToken}.html`, {
        type: "text/html;charset=utf-8",
      });
      const form = new FormData();
      form.append("file", file);
      form.append("type", "other");
      form.append("patientId", activePatient.id);

      const response = await fetch(apiUrl("/api/uploads/report"), {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(apiErrorMessage(data) || "Upload failed");
      }
      setReportsReloadKey((k) => k + 1);
      toast.success("Prescription saved to this patient's reports.");
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "Could not attach prescription"));
    } finally {
      setAttachingReport(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 mb-6">
        <Link
          to="/doctor-dashboard/queue"
          className="inline-flex w-fit items-center text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          ← Back to Queue
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Consultation</h1>
        <p className="text-sm text-gray-500">Full prescription and reports workspace for the selected queue patient.</p>
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

      {!loading && appointmentId && !existsInQueue && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
          This queue appointment was not found or is no longer active.
        </div>
      )}

      {activePatient && selectedAppt ? (
        <div className="space-y-5">
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

          {selectedAppt.chief_complaint ? (
            <div className="rounded-2xl border-2 border-blue-100 bg-gradient-to-br from-blue-50/90 to-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Patient description (from intake)</p>
              <p className="mt-2 text-base text-gray-900 leading-relaxed">{selectedAppt.chief_complaint}</p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-4 sm:p-6 shadow-sm">
            <h4 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-700" />
              Prescription (medicines)
            </h4>
            <p className="text-xs text-gray-600 mb-4">
              Add drugs here first; search NIH RxNorm + clinic list. Optional Google Custom Search when configured on the server.
            </p>
            <MedicineTable medicines={medicines} onChange={setMedicines} editable={true} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-1">Visit documentation</h3>
            <p className="text-xs text-gray-500 mb-4">Brief notes, voice conversation, and English summary — handwriting is optional.</p>
            <PrescriptionCanvas
              key={selectedAppointmentId ?? "none"}
              value={prescriptionNotes}
              onChange={setPrescriptionNotes}
              isRecording={false}
              showHandwriting={true}
              onHandwritingChange={setHandwritingStrokes}
              onVoiceOutput={setVoiceSession}
            />
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
                <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap max-h-[min(40vh,320px)] overflow-y-auto">
                  {voiceTranscript}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => void handlePrintPrescription()}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
            <button
              type="button"
              onClick={() => void handleExportPrescriptionHtml()}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
            <button
              type="button"
              onClick={() => void handleAttachPrescriptionToReports()}
              disabled={attachingReport}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg font-semibold transition-colors disabled:opacity-60"
            >
              {attachingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              Save to reports
            </button>
            <button
              type="button"
              onClick={handleGeneratePrescription}
              disabled={completing}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg font-semibold transition-colors"
            >
              {completing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Complete
            </button>
          </div>

          <section
            id="visit-reports"
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm scroll-mt-24"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">Diagnostic reports</h3>
            <p className="text-xs text-gray-600 mb-4">
              Upload X-rays, labs, and other files for <span className="font-semibold">{activePatient.name}</span>. Use{" "}
              <span className="font-semibold">Save to reports</span> above to store the current prescription HTML in this list.
            </p>
            <ReportsTab
              patientId={activePatient.id}
              patientName={activePatient.name}
              clinicId={clinicId}
              reloadKey={reportsReloadKey}
            />
          </section>
        </div>
      ) : (
        <QueueList rows={rows} loading={loading} />
      )}
    </div>
  );
}
