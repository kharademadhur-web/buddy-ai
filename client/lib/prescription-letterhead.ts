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

  const medicineRows = input.medicines.length
    ? input.medicines.map(
        (m, index) => `<tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(m.name || "Medicine")}</strong></td>
          <td>${escapeHtml(m.dosage || "")}</td>
          <td>${escapeHtml(m.frequency || "")}</td>
          <td>${escapeHtml(m.duration || "")}</td>
        </tr>`
      )
    : [
        `<tr>
          <td>1</td>
          <td colspan="4">No medicines added.</td>
        </tr>`,
      ];

  // Simple deterministic pagination for print/PDF. The page container is flex,
  // and only the final page receives the summary box with margin-top:auto.
  const firstPageCapacity = notesText.length > 700 || complaintText.length > 400 ? 6 : 10;
  const nextPageCapacity = notesText.length > 700 ? 12 : 16;
  const pages: string[][] = [];
  let remaining = [...medicineRows];
  pages.push(remaining.splice(0, firstPageCapacity));
  while (remaining.length > 0 && pages.length < 3) {
    pages.push(remaining.splice(0, nextPageCapacity));
  }
  if (remaining.length > 0) pages[pages.length - 1]!.push(...remaining);

  const renderPage = (rows: string[], index: number) => {
    const isFirst = index === 0;
    const isLast = index === pages.length - 1;
    return `<div class="paper page">
      ${
        hasImageLetterhead
          ? `<img class="letterheadBg" src="${escapeHtml(input.clinicLetterhead!.templateUrl)}" alt="Clinic letterhead" />`
          : ""
      }
      <div class="pageOverlay">
        ${
          isFirst
            ? hasImageLetterhead
              ? `<div class="letterheadSpacer"></div>`
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
            : `<div class="continuedHeader">
                <strong>${escapeHtml(clinicName)}</strong>
                <span>${escapeHtml(input.patient.name)} - page ${index + 1}</span>
              </div>`
        }

        ${
          isFirst
            ? `<section class="patientGrid">
                <div><strong>Patient:</strong> ${escapeHtml(input.patient.name)}</div>
                <div><strong>Age/Gender:</strong> ${escapeHtml(ageGenderText || "—")}</div>
                <div><strong>Phone:</strong> ${escapeHtml(phoneText)}</div>
                ${tokenText ? `<div><strong>Token:</strong> ${escapeHtml(tokenText)}</div>` : ""}
                <div><strong>Doctor:</strong> ${escapeHtml(input.doctorName)}</div>
                <div><strong>Date:</strong> ${escapeHtml(input.visitDateText)}</div>
              </section>
              <section class="block">
                <h3>Chief complaint</h3>
                <div class="preserve">${escapeHtml(complaintText)}</div>
              </section>`
            : ""
        }

        <section class="block">
          <h3>Prescription ${pages.length > 1 ? `(page ${index + 1})` : ""}</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </section>

        ${
          isLast
            ? `<section class="block">
                <h3>Clinical notes</h3>
                <div class="preserve">${escapeHtml(notesText)}</div>
              </section>
              <section class="signatureRow">
                <div>Clinic stamp</div>
                <div>Doctor signature<br/><strong>${escapeHtml(input.doctorName)}</strong></div>
              </section>
              ${
                summaryText
                  ? `<section class="summaryBox">
                      <h3>Health summary for ${escapeHtml(input.patient.name)}</h3>
                      <div class="preserve">${escapeHtml(summaryText)}</div>
                    </section>`
                  : ""
              }`
            : ""
        }
      </div>
    </div>`;
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
        height: 297mm;
        margin: 0 auto;
        background: #fff;
        overflow: hidden;
        page-break-after: always;
      }
      .paper:last-child { page-break-after: auto; }
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
      .pageOverlay {
        position: relative;
        z-index: 1;
        height: 297mm;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14mm;
      }
      .letterheadSpacer { height: 32mm; flex: 0 0 auto; }
      .continuedHeader {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 6px;
        margin-bottom: 2px;
        font-size: 12px;
        color: #374151;
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
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 7px 8px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
      .preserve { white-space: pre-wrap; }
      .stack { display: grid; gap: 8px; }
      .patientGrid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: rgba(255,255,255,0.92);
        padding: 10px;
        font-size: 12px;
      }
      .signatureRow {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        min-height: 20mm;
        color: #374151;
        font-size: 12px;
        padding-top: 8px;
      }
      .summaryBox {
        margin-top: auto;
        border: 1px solid #93c5fd;
        border-left: 5px solid #2563eb;
        border-radius: 10px;
        background: #eff6ff;
        color: #1e3a8a;
        padding: 10px 12px;
        font-style: italic;
        font-size: 12px;
        line-height: 1.45;
      }
      .summaryBox h3 {
        margin: 0 0 5px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .04em;
        color: #1d4ed8;
        font-style: normal;
      }
      @media print {
        body { background: #fff; }
        .paper { margin: 0; }
      }
    </style>
  </head>
  <body>
    ${pages.map(renderPage).join("")}
  </body>
</html>`;
}
