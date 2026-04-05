/**
 * Smoke-test script for the Doctor+Receptionist workflow API.
 *
 * Usage (PowerShell example):
 *   $env:BASE_URL="http://localhost:8080"
 *   $env:ACCESS_TOKEN="<JWT>"
 *   $env:CLINIC_ID="<uuid>"
 *   $env:PATIENT_ID="<uuid>"
 *   $env:DOCTOR_USER_ID="<uuid>"
 *   pnpm smoke:workflow
 *
 * This script does not create a patient (depends on your onboarding strategy).
 */

type Json = Record<string, unknown>;

const BASE_URL = (process.env.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";
const CLINIC_ID = process.env.CLINIC_ID || "";
const PATIENT_ID = process.env.PATIENT_ID || "";
const DOCTOR_USER_ID = process.env.DOCTOR_USER_ID || "";

function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing env ${name}`);
}

async function http<T extends Json>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      ...(init.headers as any),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${(data as any).error || (data as any).message || "error"}`);
  }
  return data;
}

async function main() {
  requireEnv("ACCESS_TOKEN", ACCESS_TOKEN);
  requireEnv("CLINIC_ID", CLINIC_ID);
  requireEnv("PATIENT_ID", PATIENT_ID);
  requireEnv("DOCTOR_USER_ID", DOCTOR_USER_ID);

  console.log("1) Create appointment");
  const appt = await http<any>("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      doctorUserId: DOCTOR_USER_ID,
      appointmentTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      chiefComplaint: "Fever and headache",
    }),
  });
  const appointmentId = appt.appointment?.id;
  console.log({ appointmentId });

  console.log("2) Check-in appointment");
  await http<any>(`/api/appointments/${appointmentId}/checkin`, {
    method: "POST",
    body: JSON.stringify({
      chiefComplaint: "Fever and headache (2 days)",
      vitals: { temperature_f: 101.5, bp: "120/80" },
      intakeHistory: { allergies: "none", meds: "none" },
    }),
  });

  console.log("3) Complete consultation");
  await http<any>("/api/consultations/complete", {
    method: "POST",
    body: JSON.stringify({
      clinicId: CLINIC_ID,
      appointmentId,
      patientId: PATIENT_ID,
      diagnosis: "Viral fever",
      treatmentPlan: "Rest + fluids",
      notes: "Follow up in 3 days if persists",
      prescription: {
        followUpDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        items: [
          { name: "Paracetamol", dosage: "500mg", frequency: "BD", duration: "3 days", quantity: 10 },
        ],
      },
    }),
  });

  console.log("4) Create bill");
  const bill = await http<any>("/api/billing", {
    method: "POST",
    body: JSON.stringify({
      clinicId: CLINIC_ID,
      appointmentId,
      patientId: PATIENT_ID,
      consultationFee: 500,
      medicineCost: 200,
    }),
  });
  const billId = bill.bill?.id;
  console.log({ billId });

  console.log("5) Pay bill");
  await http<any>(`/api/billing/${billId}/payments`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod: "upi" }),
  });

  console.log("OK: workflow completed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

