/**
 * SaaS core flow smoke checks (token-driven).
 *
 * Required env:
 * - BASE_URL (default http://localhost:8080)
 * - ADMIN_TOKEN
 * - RECEPTION_TOKEN
 * - DOCTOR_TOKEN
 * - CLINIC_ID
 * - DOCTOR_USER_ID
 *
 * Patient env (one of):
 * - PATIENT_ID — single-patient legacy flow (creates 1 appointment for this patient)
 * - omit PATIENT_ID — creates FLOW_PATIENTS new patients (default 3), vitals, appointments, full loop
 *
 * Optional:
 * - FLOW_PATIENTS=3   (when PATIENT_ID unset)
 * - SKIP_MUTATION=true  (admin + read-only API checks only; no DB writes)
 */

type AnyJson = Record<string, unknown>;

const BASE_URL = (process.env.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const RECEPTION_TOKEN = process.env.RECEPTION_TOKEN || "";
const DOCTOR_TOKEN = process.env.DOCTOR_TOKEN || "";
const CLINIC_ID = process.env.CLINIC_ID || "";
const DOCTOR_USER_ID = process.env.DOCTOR_USER_ID || "";
const PATIENT_ID_LEGACY = process.env.PATIENT_ID || "";
const FLOW_PATIENTS = Math.min(
  10,
  Math.max(1, parseInt(process.env.FLOW_PATIENTS || "3", 10) || 3)
);
const SKIP_MUTATION = String(process.env.SKIP_MUTATION || "").toLowerCase() === "true";

function must(name: string, val: string): void {
  if (!val) throw new Error(`Missing env ${name}`);
}

async function req<T extends AnyJson>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    const e = json as { error?: unknown; message?: unknown };
    const msg =
      (typeof e.message === "string" && e.message) ||
      (typeof e.error === "string" && e.error) ||
      (e.error && typeof e.error === "object" && "message" in (e.error as AnyJson)
        ? String((e.error as AnyJson).message || "")
        : "") ||
      `HTTP ${res.status}`;
    throw new Error(`${path}: ${msg}`);
  }
  return json;
}

async function main() {
  must("ADMIN_TOKEN", ADMIN_TOKEN);
  must("RECEPTION_TOKEN", RECEPTION_TOKEN);
  must("DOCTOR_TOKEN", DOCTOR_TOKEN);
  must("CLINIC_ID", CLINIC_ID);
  must("DOCTOR_USER_ID", DOCTOR_USER_ID);

  console.log("1) Admin surface checks");
  await req(ADMIN_TOKEN, "/api/admin/clinics");
  await req(ADMIN_TOKEN, "/api/admin/users");
  await req(ADMIN_TOKEN, "/api/admin/analytics/saas-summary");

  console.log("2) Reception + doctor read checks");
  await req(RECEPTION_TOKEN, `/api/staff/doctors?clinicId=${encodeURIComponent(CLINIC_ID)}`);
  await req(RECEPTION_TOKEN, `/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(CLINIC_ID)}`);
  await req(RECEPTION_TOKEN, `/api/queue?clinicId=${encodeURIComponent(CLINIC_ID)}`);
  await req(DOCTOR_TOKEN, `/api/queue?clinicId=${encodeURIComponent(CLINIC_ID)}&doctorId=${encodeURIComponent(DOCTOR_USER_ID)}`);
  await req(DOCTOR_TOKEN, `/api/billing/summary?clinicId=${encodeURIComponent(CLINIC_ID)}`);

  console.log("3) Medicines search API");
  const medSearch = await req<{ results?: unknown[] }>(
    DOCTOR_TOKEN,
    `/api/medicines/search?q=${encodeURIComponent("para")}&limit=5`
  );
  if (!Array.isArray(medSearch.results) || medSearch.results.length < 1) {
    throw new Error("Medicines search returned no results");
  }

  if (SKIP_MUTATION) {
    console.log("SKIP_MUTATION=true — skipping mutations");
    console.log("OK: saas core smoke checks passed (read-only)");
    return;
  }

  console.log("4) Multi-patient mutation flow");

  const patientIds: string[] = [];
  if (PATIENT_ID_LEGACY) {
    patientIds.push(PATIENT_ID_LEGACY);
  } else {
    for (let i = 0; i < FLOW_PATIENTS; i++) {
      const phone = `+1555${Date.now().toString().slice(-7)}${i}`;
      const created = await req<{ patient?: { id?: string } }>(RECEPTION_TOKEN, "/api/patients", {
        method: "POST",
        body: JSON.stringify({
          clinicId: CLINIC_ID,
          name: `E2E Patient ${i + 1}`,
          phone,
          dateOfBirth: "1992-06-15",
          gender: i % 2 === 0 ? "male" : "female",
        }),
      });
      const pid = created.patient?.id;
      if (!pid) throw new Error("Patient id missing after create");
      patientIds.push(pid);

      await req(
        RECEPTION_TOKEN,
        `/api/patients/${pid}/vitals?clinicId=${encodeURIComponent(CLINIC_ID)}`,
        {
          method: "POST",
          body: JSON.stringify({
            bpSystolic: 118 + i,
            bpDiastolic: 78,
            heartRate: 70 + i,
          }),
        }
      );
    }
  }

  const appointmentIds: string[] = [];
  const baseTime = Date.now();
  for (let i = 0; i < patientIds.length; i++) {
    const patientId = patientIds[i]!;
    const appointment = await req<{ appointment?: { id?: string; status?: string } }>(RECEPTION_TOKEN, "/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        clinicId: CLINIC_ID,
        patientId,
        doctorUserId: DOCTOR_USER_ID,
        appointmentTime: new Date(baseTime + (i + 1) * 120_000).toISOString(),
        chiefComplaint: `E2E complaint ${i + 1}`,
      }),
    });
    const appointmentId = appointment.appointment?.id;
    if (!appointmentId) throw new Error("Appointment id missing");
    appointmentIds.push(appointmentId);

    const checkedIn = await req<{ appointment?: { id?: string; status?: string } }>(
      RECEPTION_TOKEN,
      `/api/appointments/${appointmentId}/checkin`,
      {
        method: "POST",
        body: JSON.stringify({
          chiefComplaint: `Checked in ${i + 1}`,
          vitals: { bpSystolic: 120, bpDiastolic: 80, heartRate: 72 },
        }),
      }
    );
    if (checkedIn.appointment?.status !== "checked_in") {
      throw new Error(`Expected checked_in, got ${checkedIn.appointment?.status}`);
    }
  }

  const queueRes = await req<{ queue?: Array<{ id: string; status: string }> }>(
    RECEPTION_TOKEN,
    `/api/queue?clinicId=${encodeURIComponent(CLINIC_ID)}&doctorId=${encodeURIComponent(DOCTOR_USER_ID)}`
  );
  const q = queueRes.queue ?? [];
  const queueIdSet = new Set(q.map((x) => x.id));
  for (const aid of appointmentIds) {
    if (!queueIdSet.has(aid)) {
      throw new Error(`Appointment ${aid} not in queue (expected all created appointments)`);
    }
  }
  for (const row of q) {
    if (row.id && appointmentIds.includes(row.id)) {
      if (row.status !== "checked_in" && row.status !== "in_consultation") {
        throw new Error(`Queue row unexpected status ${row.status} (want checked_in or in_consultation)`);
      }
    }
  }

  for (let i = 0; i < appointmentIds.length; i++) {
    const appointmentId = appointmentIds[i]!;
    const patientId = patientIds[i]!;

    const completeBody: Record<string, unknown> = {
      clinicId: CLINIC_ID,
      appointmentId,
      patientId,
      diagnosis: `E2E diagnosis ${i + 1}`,
      notes: `E2E notes ${i + 1}`,
      prescription: {
        items: [{ name: "Paracetamol", dosage: "500mg", frequency: "BD", duration: "3d" }],
      },
    };
    if (i === 0) {
      completeBody.handwritingStrokes = {
        version: 1,
        lines: [{ points: [[4, 4], [40, 40], [80, 20]] }],
      };
    }

    await req(DOCTOR_TOKEN, "/api/consultations/complete", {
      method: "POST",
      body: JSON.stringify(completeBody),
    });

    const apList = await req<{ appointments?: Array<{ id: string; status: string }> }>(
      DOCTOR_TOKEN,
      `/api/appointments?clinicId=${encodeURIComponent(CLINIC_ID)}&doctorId=${encodeURIComponent(DOCTOR_USER_ID)}`
    );
    const done = apList.appointments?.find((x) => x.id === appointmentId);
    if (done?.status !== "completed") {
      throw new Error(`Appointment ${appointmentId} expected completed, got ${done?.status}`);
    }

    const bill = await req<{ bill?: { id?: string } }>(RECEPTION_TOKEN, "/api/billing", {
      method: "POST",
      body: JSON.stringify({
        clinicId: CLINIC_ID,
        appointmentId,
        patientId,
        consultationFee: 500,
        medicineCost: 0,
      }),
    });
    const billId = bill.bill?.id;
    if (!billId) throw new Error("Bill id missing");
    await req(RECEPTION_TOKEN, `/api/billing/${billId}/payments`, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: "upi" }),
    });
  }

  const queueAfter = await req<{ queue?: Array<{ id: string }> }>(
    DOCTOR_TOKEN,
    `/api/queue?clinicId=${encodeURIComponent(CLINIC_ID)}&doctorId=${encodeURIComponent(DOCTOR_USER_ID)}`
  );
  const stillThere = (queueAfter.queue ?? []).filter((x) => appointmentIds.includes(x.id));
  if (stillThere.length !== 0) {
    throw new Error("Queue should not list completed appointments");
  }

  console.log("OK: saas core smoke checks passed (full multi-patient flow)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
