import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export async function shareHtmlAsPdf(params: { title: string; html: string }) {
  const file = await Print.printToFileAsync({
    html: params.html,
    base64: false,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    dialogTitle: params.title,
    UTI: "com.adobe.pdf",
  });
}

export function prescriptionHtml(params: {
  clinicName?: string;
  doctorName: string;
  patientName: string;
  date: string;
  diagnosis?: string;
  items: Array<{ name: string; dosage?: string; frequency?: string; duration?: string; quantity?: number }>;
  notes?: string;
  followUpDate?: string;
}) {
  const rows = params.items
    .map(
      (it, idx) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #ddd;"><b>${escapeHtml(it.name)}</b><br/><span style="color:#555;">${escapeHtml(it.dosage || "")}</span></td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(it.frequency || "")}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(it.duration || "")}</td>
        <td style="padding:8px;border:1px solid #ddd;">${it.quantity ?? ""}</td>
      </tr>`
    )
    .join("");

  return `
  <html>
    <body style="font-family: Arial, sans-serif; padding: 24px;">
      <h2 style="margin:0;">${escapeHtml(params.clinicName || "Clinic")}</h2>
      <p style="margin:6px 0 18px 0;color:#444;">Prescription</p>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <div><b>Patient</b>: ${escapeHtml(params.patientName)}</div>
        <div><b>Date</b>: ${escapeHtml(params.date)}</div>
      </div>
      <div style="margin-bottom:12px;"><b>Doctor</b>: ${escapeHtml(params.doctorName)}</div>
      ${params.diagnosis ? `<div style="margin-bottom:12px;"><b>Diagnosis</b>: ${escapeHtml(params.diagnosis)}</div>` : ""}
      <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">#</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Medicine</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Frequency</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Duration</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${params.notes ? `<p style="margin-top:14px;"><b>Notes</b>: ${escapeHtml(params.notes)}</p>` : ""}
      ${params.followUpDate ? `<p style="margin-top:6px;"><b>Follow-up</b>: ${escapeHtml(params.followUpDate)}</p>` : ""}
      <p style="margin-top:28px;color:#666;">Signature: ____________________</p>
    </body>
  </html>`;
}

export function billHtml(params: {
  clinicName?: string;
  patientName: string;
  date: string;
  consultationFee: number;
  medicineCost: number;
  total: number;
  paymentMethod?: string;
}) {
  return `
  <html>
    <body style="font-family: Arial, sans-serif; padding: 24px;">
      <h2 style="margin:0;">${escapeHtml(params.clinicName || "Clinic")}</h2>
      <p style="margin:6px 0 18px 0;color:#444;">Receipt</p>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <div><b>Patient</b>: ${escapeHtml(params.patientName)}</div>
        <div><b>Date</b>: ${escapeHtml(params.date)}</div>
      </div>
      <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #ddd;">Consultation</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">₹${params.consultationFee.toFixed(2)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;">Medicines (estimate)</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">₹${params.medicineCost.toFixed(2)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;"><b>Total</b></td><td style="padding:8px;border:1px solid #ddd;text-align:right;"><b>₹${params.total.toFixed(2)}</b></td></tr>
        </tbody>
      </table>
      ${params.paymentMethod ? `<p style="margin-top:14px;"><b>Payment</b>: ${escapeHtml(params.paymentMethod)}</p>` : ""}
    </body>
  </html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

