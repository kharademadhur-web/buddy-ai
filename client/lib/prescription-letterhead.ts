import type { LetterheadFieldMap } from "@shared/api";
import type { Letterhead, Medicine } from "@/context/ClinicContext";

type PrescriptionHtmlInput = {
  clinicLetterhead: Letterhead | null;
  fieldMap?: LetterheadFieldMap;
  clinicMeta?: { name: string; phone?: string | null; address?: string | null } | null;
  patient: {
    name: string;
    phone?: string | null;
    age?: string | number | null;
    gender?: string | null;
    token?: string | number | null;
  };
  doctorName: string;
  visitDateText: string;
  complaint?: string | null;
  notes?: string | null;
  summary?: string | null;
  medicines: Medicine[];
};

const fmtPct = (n: number | undefined, fallback: number) => `${Number.isFinite(n) ? n : fallback}%`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const looksLikePdfMime = (mime?: string) => String(mime || "").toLowerCase().includes("pdf");

const looksLikePdfUrl = (url?: string) => {
  const v = String(url || "").toLowerCase();
  return v.includes(".pdf") || v.includes("application/pdf");
};

export function buildPrescriptionHtml(input: PrescriptionHtmlInput): string {
  const clinicName = input.clinicLetterhead?.clinicName || input.clinicMeta?.name || "Clinic";
  const clinicAddress = input.clinicLetterhead?.clinicAddress || input.clinicMeta?.address || "";
  const clinicPhone = input.clinicLetterhead?.clinicPhone || input.clinicMeta?.phone || "";
  const hasImageLetterhead = Boolean(
    input.clinicLetterhead?.templateUrl &&
      !looksLikePdfMime(input.clinicLetterhead?.mime) &&
      !looksLikePdfUrl(input.clinicLetterhead?.templateUrl)
  );

  const ageText = input.patient.age != null && `${input.patient.age}`.trim() ? `${input.patient.age}` : "—";
  const genderText = input.patient.gender ? String(input.patient.gender) : "";
  const ageGenderText = [ageText, genderText].filter(Boolean).join(" / ");
  const phoneText = input.patient.phone || "—";
  const complaintText = input.complaint?.trim() || "—";
  const notesText = input.notes?.trim() || "—";
  const summaryText = input.summary?.trim() || "";
  const tokenText = input.patient.token != null && `${input.patient.token}`.trim() ? `#${input.patient.token}` : "";

  const medsHtml = input.medicines.length
    ? input.medicines
        .map((m) => {
          const details = [m.dosage, m.frequency, m.duration].filter(Boolean).join(" | ");
          return `<li><strong>${escapeHtml(m.name || "Medicine")}</strong>${details ? ` - ${escapeHtml(details)}` : ""}</li>`;
        })
        .join("")
    : "<li>No medicines added.</li>";

  const box = {
    patientName: input.fieldMap?.patientName,
    ageGender: input.fieldMap?.ageGender,
    phone: input.fieldMap?.phone,
    prescriptionArea: input.fieldMap?.prescriptionArea,
    aiSummaryArea: input.fieldMap?.aiSummaryArea,
  };

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Prescription - ${escapeHtml(input.patient.name)}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #111827; background: #f3f4f6; }
      .paper {
        position: relative;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        background: #fff;
        overflow: hidden;
      }
      .letterheadBg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .overlay {
        position: relative;
        min-height: 297mm;
        padding: 14mm;
      }
      .fallbackHeader {
        border-bottom: 2px solid #1f2937;
        padding-bottom: 8px;
        margin-bottom: 10px;
      }
      .fallbackRow {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .fallbackClinic { font-size: 21px; font-weight: 700; margin: 0; }
      .muted { color: #4b5563; font-size: 12px; }
      .abs {
        position: absolute;
        background: rgba(255,255,255,0.82);
        border: 1px solid rgba(17,24,39,0.15);
        border-radius: 6px;
        padding: 6px 8px;
      }
      .block {
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: rgba(255,255,255,0.92);
        padding: 10px;
      }
      .block h3 {
        margin: 0 0 6px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .03em;
      }
      ul { margin: 6px 0 0 18px; padding: 0; }
      li { margin: 4px 0; }
      .preserve { white-space: pre-wrap; }
      .stack { display: grid; gap: 8px; }
      @media print {
        body { background: #fff; }
        .paper { margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="paper">
      ${
        hasImageLetterhead
          ? `<img class="letterheadBg" src="${escapeHtml(input.clinicLetterhead!.templateUrl)}" alt="Clinic letterhead" />`
          : ""
      }
      <div class="overlay">
        ${
          hasImageLetterhead
            ? ""
            : `<div class="fallbackHeader">
                <div class="fallbackRow">
                  <div>
                    <p class="fallbackClinic">${escapeHtml(clinicName)}</p>
                    ${clinicAddress ? `<div class="muted">${escapeHtml(clinicAddress)}</div>` : ""}
                    ${clinicPhone ? `<div class="muted">Phone: ${escapeHtml(clinicPhone)}</div>` : ""}
                  </div>
                  <div style="text-align:right">
                    <div><strong>${escapeHtml(input.doctorName)}</strong></div>
                    <div class="muted">${escapeHtml(input.visitDateText)}</div>
                  </div>
                </div>
              </div>`
        }

        <div class="abs" style="left:${fmtPct(box.patientName?.xPct, 8)}; top:${fmtPct(box.patientName?.yPct, hasImageLetterhead ? 14 : 18)}; width:${fmtPct(box.patientName?.wPct, 46)}; min-height:${fmtPct(box.patientName?.hPct, 5)};">
          <strong>Patient:</strong> ${escapeHtml(input.patient.name)}
          ${tokenText ? `<span style="float:right"><strong>Token:</strong> ${escapeHtml(tokenText)}</span>` : ""}
        </div>

        <div class="abs" style="left:${fmtPct(box.ageGender?.xPct, 8)}; top:${fmtPct(box.ageGender?.yPct, hasImageLetterhead ? 21 : 24)}; width:${fmtPct(box.ageGender?.wPct, 36)}; min-height:${fmtPct(box.ageGender?.hPct, 4.8)};">
          <strong>Age/Gender:</strong> ${escapeHtml(ageGenderText || "—")}
        </div>

        <div class="abs" style="left:${fmtPct(box.phone?.xPct, 8)}; top:${fmtPct(box.phone?.yPct, hasImageLetterhead ? 27.4 : 29.8)}; width:${fmtPct(box.phone?.wPct, 36)}; min-height:${fmtPct(box.phone?.hPct, 4.8)};">
          <strong>Phone:</strong> ${escapeHtml(phoneText)}
        </div>

        <div class="abs" style="right:8%; top:${hasImageLetterhead ? "14%" : "18%"}; width:34%; min-height:10%;">
          <div><strong>Doctor:</strong> ${escapeHtml(input.doctorName)}</div>
          <div class="muted" style="margin-top:4px;">${escapeHtml(input.visitDateText)}</div>
        </div>

        <div class="stack" style="position:absolute; left:${fmtPct(box.prescriptionArea?.xPct, 8)}; top:${fmtPct(box.prescriptionArea?.yPct, hasImageLetterhead ? 36 : 40)}; width:${fmtPct(box.prescriptionArea?.wPct, 84)};">
          <section class="block">
            <h3>Chief complaint (Reception)</h3>
            <div class="preserve">${escapeHtml(complaintText)}</div>
          </section>
          <section class="block">
            <h3>Prescription (Medicines)</h3>
            <ul>${medsHtml}</ul>
          </section>
          <section class="block">
            <h3>Clinical notes</h3>
            <div class="preserve">${escapeHtml(notesText)}</div>
          </section>
        </div>

        ${
          summaryText
            ? `<section class="block" style="position:absolute; left:${fmtPct(
                box.aiSummaryArea?.xPct,
                8
              )}; top:${fmtPct(box.aiSummaryArea?.yPct, 78)}; width:${fmtPct(box.aiSummaryArea?.wPct, 84)}; min-height:${fmtPct(
                box.aiSummaryArea?.hPct,
                12
              )};">
                <h3>Conversation summary</h3>
                <div class="preserve">${escapeHtml(summaryText)}</div>
              </section>`
            : ""
        }
      </div>
    </div>
  </body>
</html>`;
}
