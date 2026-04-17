import { useMemo, useState } from "react";
import { useDoctorPortal } from "@/context/DoctorPortalContext";
import { FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DoctorPrescriptionsPage() {
  const { clinicId, recentConsultations, recentLoading, clinicMeta, clinicLetterhead, clinicLetterheadFieldMap, user } =
    useDoctorPortal();
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [printFormat, setPrintFormat] = useState<"overlay" | "plain">("overlay");

  const selectedConsultation = useMemo(() => {
    if (!selectedConsultationId) return null;
    return recentConsultations.find((c) => c.consultationId === selectedConsultationId) ?? null;
  }, [selectedConsultationId, recentConsultations]);

  const handlePrintSelected = () => {
    if (!selectedConsultation) return;

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const safe = (value: string | null | undefined) => escapeHtml((value || "—").trim() || "—");

    const fallbackFieldMap = {
      patientName: { xPct: 8, yPct: 14, wPct: 44, hPct: 6 },
      ageGender: { xPct: 8, yPct: 22, wPct: 36, hPct: 5 },
      phone: { xPct: 8, yPct: 29, wPct: 36, hPct: 5 },
      prescriptionArea: { xPct: 8, yPct: 38, wPct: 84, hPct: 28 },
      aiSummaryArea: { xPct: 8, yPct: 70, wPct: 84, hPct: 18 },
    };
    const fieldMap =
      clinicLetterheadFieldMap && Object.keys(clinicLetterheadFieldMap).length > 0
        ? clinicLetterheadFieldMap
        : fallbackFieldMap;
    const boxStyle = (
      key: keyof typeof fallbackFieldMap,
      fallback: { xPct: number; yPct: number; wPct: number; hPct: number },
    ) => {
      const box = (fieldMap[key] as typeof fallback | undefined) || fallback;
      return `left:${box.xPct}%;top:${box.yPct}%;width:${box.wPct ?? fallback.wPct}%;height:${box.hPct ?? fallback.hPct}%;`;
    };

    const dateText = selectedConsultation.createdAt
      ? new Date(selectedConsultation.createdAt).toLocaleString()
      : "—";
    const patientName = selectedConsultation.patient?.name ?? "—";
    const patientPhone = selectedConsultation.patient?.phone ?? "—";
    const clinicName = clinicMeta?.name?.trim() || "SmartClinic";
    const clinicPhone = clinicMeta?.phone?.trim() || "";
    const clinicAddress = clinicMeta?.address?.trim() || "";
    const doctorName = user?.name?.trim() || "Doctor";
    const doctorRole = user?.role === "independent" ? "Independent Doctor" : "Doctor";
    const notes =
      selectedConsultation.diagnosis ||
      selectedConsultation.notes ||
      selectedConsultation.prescription?.notes ||
      "—";
    const meds = selectedConsultation.prescription?.items ?? [];
    const medsHtml = meds.length
      ? meds
          .map((item) => {
            const details = [item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ");
            return `<li><strong>${safe(item.name)}</strong>${details ? ` — ${safe(details)}` : ""}</li>`;
          })
          .join("")
      : "<li>No medicines were recorded.</li>";

    const hasImageLetterhead = Boolean(
      clinicLetterhead?.templateUrl && !String(clinicLetterhead?.mime || "").toLowerCase().includes("pdf"),
    );
    const useOverlay = printFormat === "overlay" && hasImageLetterhead;
    const letterheadImageUrl = useOverlay ? clinicLetterhead?.templateUrl || "" : "";

    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) return;

    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Prescription Details</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      body { font-family: Arial, sans-serif; color: #111827; margin: 0; line-height: 1.45; background: #f3f4f6; }
      .page-wrap { padding: 10mm; display: flex; justify-content: center; }
      .sheet { width: 190mm; min-height: 277mm; background: #fff; position: relative; box-shadow: 0 2px 10px rgba(0,0,0,0.08); overflow: hidden; }
      .sheet::before { content: ""; position: absolute; inset: 0; background-image: ${
        useOverlay ? `url("${letterheadImageUrl}")` : "none"
      }; background-size: cover; background-repeat: no-repeat; background-position: center; opacity: ${
        useOverlay ? "1" : "0"
      }; z-index: 0; }
      .overlay { position: absolute; z-index: 1; border-radius: 4px; background: rgba(255,255,255,0.86); padding: 2mm 2.4mm; font-size: 12px; overflow: hidden; }
      .overlay h3 { margin: 0 0 3px; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #374151; }
      h1 { margin: 0; font-size: 22px; }
      h2 { margin: 0 0 8px; font-size: 16px; }
      .muted { color: #4b5563; font-size: 13px; }
      .header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
      .header-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .clinic-meta { margin-top: 4px; font-size: 12px; color: #374151; }
      .doctor-box { text-align: right; font-size: 12px; color: #111827; }
      .doctor-box .name { font-size: 14px; font-weight: 700; }
      .section { margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      ul { margin: 8px 0 0 20px; padding: 0; }
      li { margin: 4px 0; }
      .overlay ul { margin: 6px 0 0 18px; }
      .fallback-content { position: relative; z-index: 1; padding: 8mm 10mm 10mm; }
      @media print { body { background: #fff; } .page-wrap { padding: 0; } .sheet { box-shadow: none; width: 100%; min-height: auto; } }
    </style>
  </head>
  <body>
    <div class="page-wrap">
      <div class="sheet">
        ${
          useOverlay
            ? `
        <div class="overlay" style="${boxStyle("patientName", fallbackFieldMap.patientName)}"><strong>Patient:</strong> ${safe(patientName)}</div>
        <div class="overlay" style="${boxStyle("ageGender", fallbackFieldMap.ageGender)}"><strong>Visit:</strong> ${safe(dateText)}</div>
        <div class="overlay" style="${boxStyle("phone", fallbackFieldMap.phone)}"><strong>Phone:</strong> ${safe(patientPhone)}</div>
        <div class="overlay" style="${boxStyle("prescriptionArea", fallbackFieldMap.prescriptionArea)}"><h3>Medicines</h3><ul>${medsHtml}</ul></div>
        <div class="overlay" style="${boxStyle("aiSummaryArea", fallbackFieldMap.aiSummaryArea)}"><h3>Diagnosis / Notes</h3><div>${safe(notes)}</div></div>
        `
            : `
        <div class="fallback-content">
          <div class="header">
            <div class="header-top">
              <div>
                <h1>${safe(clinicName)}</h1>
                <div class="clinic-meta">
                  ${clinicPhone ? `<div>Phone: ${safe(clinicPhone)}</div>` : ""}
                  ${clinicAddress ? `<div>${safe(clinicAddress)}</div>` : ""}
                </div>
              </div>
              <div class="doctor-box">
                <div class="name">${safe(doctorName)}</div>
                <div>${safe(doctorRole)}</div>
                <div class="muted">Visit: ${safe(dateText)}</div>
              </div>
            </div>
          </div>
          <div class="section"><h2>Patient</h2><div>Name: ${safe(patientName)}</div><div>Phone: ${safe(patientPhone)}</div></div>
          <div class="section"><h2>Diagnosis / Notes</h2><div>${safe(notes)}</div></div>
          <div class="section"><h2>Medicines</h2><ul>${medsHtml}</ul></div>
        </div>
        `
        }
      </div>
    </div>
  </body>
</html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Prescriptions</h1>
        <p className="text-sm text-gray-500">Recent completed visits and medicines</p>
      </div>

      {clinicId ? (
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Recent prescriptions
            </CardTitle>
            <CardDescription>
              Medicines and notes from completed consultations (by patient).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history…
              </div>
            ) : recentConsultations.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No completed consultations yet. When you finish a visit with medicines or notes, they will appear here.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      <th className="px-3 py-2 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 whitespace-nowrap">Patient</th>
                      <th className="px-3 py-2 whitespace-nowrap">Phone</th>
                      <th className="px-3 py-2 min-w-[200px]">Medicines</th>
                      <th className="px-3 py-2 min-w-[120px]">Notes / diagnosis</th>
                      <th className="px-3 py-2 whitespace-nowrap text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentConsultations.map((c) => {
                      const dt = c.createdAt ? new Date(c.createdAt) : null;
                      const medSummary = c.prescription?.items?.length
                        ? c.prescription.items
                            .map((it) => [it.name, it.dosage, it.frequency].filter(Boolean).join(" · "))
                            .join("; ")
                        : "—";
                      const extra = c.diagnosis || c.notes || c.prescription?.notes || "—";
                      return (
                        <tr key={c.consultationId} className="bg-white hover:bg-gray-50/80">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">{c.patient?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.patient?.phone ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-800">{medSummary}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-md truncate" title={extra}>
                            {extra}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedConsultationId(c.consultationId)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-gray-500">No clinic assigned.</p>
      )}

      <Dialog
        open={Boolean(selectedConsultation)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConsultationId(null);
            setPrintFormat("overlay");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescription details</DialogTitle>
            <DialogDescription>
              {selectedConsultation?.patient?.name ?? "Patient"} -{" "}
              {selectedConsultation?.createdAt
                ? new Date(selectedConsultation.createdAt).toLocaleString()
                : "Visit"}
            </DialogDescription>
          </DialogHeader>

          {selectedConsultation ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Print format</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={printFormat === "overlay" ? "default" : "outline"}
                    onClick={() => setPrintFormat("overlay")}
                    disabled={!clinicLetterhead?.templateUrl}
                  >
                    Print with letterhead overlay
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={printFormat === "plain" ? "default" : "outline"}
                    onClick={() => setPrintFormat("plain")}
                  >
                    Print plain format
                  </Button>
                </div>
                {!clinicLetterhead?.templateUrl ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Letterhead image is not available for this clinic, so plain format will be used.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Patient</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedConsultation.patient?.name ?? "—"}</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Phone</p>
                  <p className="mt-1 font-semibold text-gray-900">{selectedConsultation.patient?.phone ?? "—"}</p>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-500">Diagnosis / notes</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-900">
                  {selectedConsultation.diagnosis ||
                    selectedConsultation.notes ||
                    selectedConsultation.prescription?.notes ||
                    "—"}
                </p>
              </div>

              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Medicines</p>
                {selectedConsultation.prescription?.items?.length ? (
                  <div className="space-y-2">
                    {selectedConsultation.prescription.items.map((item, idx) => (
                      <div key={`${item.name}-${idx}`} className="rounded-md border border-gray-100 bg-gray-50 p-2">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          {[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ") || "No dosage details"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">No medicines were recorded.</p>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={handlePrintSelected}>
              Print
            </Button>
            <Button type="button" variant="outline" onClick={() => setSelectedConsultationId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
