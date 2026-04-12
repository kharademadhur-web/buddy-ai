/**
 * Full workflow (API parity with Admin onboarding + portals):
 * 1) Super-admin login
 * 2) Create clinic (optional if CLINIC_ID set) — matches Admin → Onboarding step 1
 * 3) Record SaaS payment so staff can log in (new clinics are subscription "pending")
 * 4) Upload letterhead (+ optional payment QR) — same as onboarding uploads
 * 5) Create doctor, then receptionist (assigned to doctor)
 * 6) Print credentials (use /portal/login for doctor + receptionist)
 * 7) Verify staff JWT + letterhead signed URL
 * 8) Create N patients, appointments, check-ins, queue
 * 9) Doctor completes consultations; reception creates bill + records payment
 *
 * Env:
 * - BASE_URL (default http://localhost:8080)
 * - ADMIN_USER_ID + ADMIN_PASSWORD  OR  ADMIN_TOKEN / ACCESS_TOKEN
 * - CLINIC_ID — optional; if set, skip clinic creation and use this clinic
 * - FLOW_PATIENTS — default 6 (patients assigned to the doctor)
 * - SKIP_MUTATION=true — only steps 1–7 (no patients / consults / payments)
 *
 * Manual UI notes:
 * - Letterhead in product: Admin onboarding (Create Clinic) or Clinic detail / Admin clinics create.
 * - Receptionist cannot add doctors in-app; use Admin → Users (clinic-admin or super-admin).
 *   This script uses the same POST /api/admin/users as that screen.
 */

import "dotenv/config";

type Json = Record<string, unknown>;

const BASE = (process.env.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const ADMIN_TOKEN_IN = process.env.ADMIN_TOKEN || process.env.ACCESS_TOKEN || "";
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const CLINIC_ID_OVERRIDE = process.env.CLINIC_ID || "";
const FLOW_PATIENTS = Math.min(
  10,
  Math.max(1, parseInt(process.env.FLOW_PATIENTS || "6", 10) || 6)
);
const SKIP_MUTATION = String(process.env.SKIP_MUTATION || "").toLowerCase() === "true";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const runId = Date.now().toString(36);
const DEVICE_ADMIN = `e2e-admin-${runId}`;
const DEVICE_DOC = `e2e-doc-${runId}`;
const DEVICE_REC = `e2e-rec-${runId}`;

function phoneUnique(): string {
  return `+9198${String(Date.now()).slice(-9)}`;
}

async function loginPortal(user_id: string, password: string, deviceId: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, password, deviceId }),
  });
  const j = (await res.json()) as {
    success?: boolean;
    data?: { accessToken?: string };
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = j?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Login failed (${user_id}): ${msg}`);
  }
  const token = j.data?.accessToken;
  if (!j.success || !token) {
    throw new Error(`Login unexpected response: ${JSON.stringify(j)}`);
  }
  return token;
}

async function resolveAdminToken(): Promise<string> {
  if (ADMIN_TOKEN_IN) return ADMIN_TOKEN_IN;
  if (!ADMIN_USER_ID || !ADMIN_PASSWORD) {
    console.error(`
Set ADMIN_TOKEN or ACCESS_TOKEN, or ADMIN_USER_ID + ADMIN_PASSWORD (super-admin).
`);
    process.exit(2);
  }
  return loginPortal(ADMIN_USER_ID, ADMIN_PASSWORD, DEVICE_ADMIN);
}

async function jsonAuth<T extends Json>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
    message?: string;
  };
  if (!res.ok) {
    const msg =
      (typeof body.error === "object" && body.error && "message" in body.error
        ? String((body.error as { message?: string }).message)
        : "") ||
      (typeof body.message === "string" ? body.message : "") ||
      JSON.stringify(body);
    throw new Error(`${path}: ${msg}`);
  }
  return body as T;
}

async function uploadClinicAsset(
  adminToken: string,
  clinicId: string,
  kind: "letterhead" | "payment_qr"
): Promise<void> {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append(
    "file",
    new Blob([PNG_1X1], { type: "image/png" }),
    kind === "letterhead" ? "letterhead.png" : "payment-qr.png"
  );
  const res = await fetch(`${BASE}/api/admin/clinics/${clinicId}/clinic-asset`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: fd,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !(j as { success?: boolean }).success) {
    throw new Error(`${kind} upload failed: ${JSON.stringify(j)}`);
  }
}

async function req<T extends Json>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  return jsonAuth<T>(token, path, init);
}

async function main() {
  console.log("=== 1. Admin login ===\n");
  const adminToken = await resolveAdminToken();

  let clinic_id: string;
  let clinic_code: string;
  let createdNewClinic = false;

  if (CLINIC_ID_OVERRIDE) {
    console.log("=== 2. Using existing CLINIC_ID ===\n");
    const one = await jsonAuth<{
      success?: boolean;
      clinics?: Array<{ id: string; clinic_code: string; subscription_status?: string | null }>;
    }>(adminToken, "/api/admin/clinics");
    const found = (one.clinics || []).find((c) => c.id === CLINIC_ID_OVERRIDE);
    if (!found) throw new Error(`CLINIC_ID not found: ${CLINIC_ID_OVERRIDE}`);
    clinic_id = found.id;
    clinic_code = found.clinic_code;
    console.log(`Clinic ${clinic_code} (${clinic_id})\n`);
  } else {
    createdNewClinic = true;
    console.log("=== 2. Create clinic (Admin onboarding step 1) ===\n");
    const create = await jsonAuth<{ success?: boolean; clinic?: { id: string; clinic_code: string } }>(
      adminToken,
      "/api/admin/clinics",
      {
        method: "POST",
        body: JSON.stringify({
          name: `E2E Clinic ${runId}`,
          address: "123 Test Street",
          phone: "+919876543210",
          email: `e2e-${runId}@example.com`,
        }),
      }
    );
    const c = create.clinic;
    if (!c?.id || !c.clinic_code) throw new Error("Clinic create failed");
    clinic_id = c.id;
    clinic_code = c.clinic_code;
    console.log(`Created clinic ${clinic_code} (${clinic_id})\n`);
  }

  console.log("=== 3. Activate SaaS (staff login requires live subscription) ===\n");
  const listForStatus = await jsonAuth<{
    clinics?: Array<{ id: string; subscription_status?: string | null }>;
  }>(adminToken, "/api/admin/clinics");
  const row = (listForStatus.clinics || []).find((c) => c.id === clinic_id);
  const st = (row?.subscription_status || "").toLowerCase();
  const needsActivation = createdNewClinic || st === "pending" || st === "payment_due" || !st;
  if (needsActivation) {
    await jsonAuth(
      adminToken,
      `/api/admin/clinics/${encodeURIComponent(clinic_id)}/saas-payment`,
      {
        method: "POST",
        body: JSON.stringify({ amount: 1, months: 12, notes: "e2e-full-workflow script" }),
      }
    );
    console.log("Subscription set to live with paid period.\n");
  } else {
    console.log(`Clinic already ${st || "active"} — skipping SaaS payment record.\n`);
  }

  console.log("=== 4. Upload letterhead + payment QR (onboarding parity) ===\n");
  await uploadClinicAsset(adminToken, clinic_id, "letterhead");
  await uploadClinicAsset(adminToken, clinic_id, "payment_qr");
  console.log("Letterhead and payment QR uploaded (1×1 PNG placeholders).\n");

  const docPhone = phoneUnique();
  const recPhone = phoneUnique();

  console.log("=== 5. Create doctor + receptionist (Admin onboarding steps 2–3 / Users API) ===\n");
  const doctorRes = await jsonAuth<{
    user?: { id: string; user_id: string };
    credentials?: { user_id: string; password: string };
  }>(adminToken, "/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: `E2E Doctor ${runId}`,
      phone: docPhone,
      role: "doctor",
      clinic_id,
      clinic_code,
      license_number: `E2E-LIC-${runId}`,
    }),
  });
  const doctorInternalId = doctorRes.user?.id;
  const doctorUserId = doctorRes.credentials?.user_id;
  const doctorPassword = doctorRes.credentials?.password;
  if (!doctorInternalId || !doctorUserId || !doctorPassword) {
    throw new Error(`Doctor create failed: ${JSON.stringify(doctorRes)}`);
  }

  const recRes = await jsonAuth<{
    user?: { id: string; user_id: string };
    credentials?: { user_id: string; password: string };
  }>(adminToken, "/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: `E2E Reception ${runId}`,
      phone: recPhone,
      role: "receptionist",
      clinic_id,
      clinic_code,
      assigned_doctor_ids: [doctorInternalId],
    }),
  });
  const recUserId = recRes.credentials?.user_id;
  const recPassword = recRes.credentials?.password;
  if (!recUserId || !recPassword) {
    throw new Error(`Receptionist create failed: ${JSON.stringify(recRes)}`);
  }

  console.log("=== 6. Portal credentials (open /portal/login in browser) ===\n");
  console.log(`Doctor:       user_id=${doctorUserId}   password=${doctorPassword}`);
  console.log(`Receptionist: user_id=${recUserId}   password=${recPassword}`);
  console.log("");

  console.log("=== 7. Staff login + letterhead API ===\n");
  const doctorJwt = await loginPortal(doctorUserId, doctorPassword, DEVICE_DOC);
  const receptionJwt = await loginPortal(recUserId, recPassword, DEVICE_REC);

  const lh = await req<{ success?: boolean; letterhead?: { signedUrl?: string | null } }>(
    receptionJwt,
    `/api/staff/clinic/letterhead-active?clinicId=${encodeURIComponent(clinic_id)}`
  );
  if (!lh.success) throw new Error("letterhead-active failed");
  console.log(
    `Letterhead signed URL: ${lh.letterhead?.signedUrl ? "OK (present)" : "missing — check storage bucket"}`
  );

  if (SKIP_MUTATION) {
    console.log("\nSKIP_MUTATION=true — stopping before patients/consults/payments.");
    console.log("OK: e2e setup checks passed.");
    return;
  }

  console.log("\n=== 8. Patients + queue ===\n");
  const patientIds: string[] = [];
  const baseTime = Date.now();
  for (let i = 0; i < FLOW_PATIENTS; i++) {
    const phone = `+1555${String(Date.now()).slice(-7)}${i}`;
    const created = await req<{ patient?: { id?: string } }>(receptionJwt, "/api/patients", {
      method: "POST",
      body: JSON.stringify({
        clinicId: clinic_id,
        name: `E2E Patient ${i + 1}`,
        phone,
        dateOfBirth: "1992-06-15",
        gender: i % 2 === 0 ? "male" : "female",
      }),
    });
    const pid = created.patient?.id;
    if (!pid) throw new Error("Patient id missing");
    patientIds.push(pid);

    await req(receptionJwt, `/api/patients/${pid}/vitals?clinicId=${encodeURIComponent(clinic_id)}`, {
      method: "POST",
      body: JSON.stringify({
        bpSystolic: 118 + i,
        bpDiastolic: 78,
        heartRate: 70 + i,
      }),
    });
  }

  const appointmentIds: string[] = [];
  for (let i = 0; i < patientIds.length; i++) {
    const patientId = patientIds[i]!;
    const appointment = await req<{ appointment?: { id?: string } }>(receptionJwt, "/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        clinicId: clinic_id,
        patientId,
        doctorUserId: doctorInternalId,
        appointmentTime: new Date(baseTime + (i + 1) * 120_000).toISOString(),
        chiefComplaint: `E2E complaint ${i + 1}`,
      }),
    });
    const appointmentId = appointment.appointment?.id;
    if (!appointmentId) throw new Error("Appointment id missing");
    appointmentIds.push(appointmentId);

    const checkedIn = await req<{ appointment?: { status?: string } }>(
      receptionJwt,
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

  const queueRes = await req<{ queue?: Array<{ id: string }> }>(
    receptionJwt,
    `/api/queue?clinicId=${encodeURIComponent(clinic_id)}&doctorId=${encodeURIComponent(doctorInternalId)}`
  );
  const q = queueRes.queue ?? [];
  for (const aid of appointmentIds) {
    if (!q.some((row) => row.id === aid)) {
      throw new Error(`Appointment ${aid} not in queue`);
    }
  }
  console.log(`Created ${FLOW_PATIENTS} patients; all appointments checked in and visible in queue.\n`);

  console.log("=== 9. Doctor consults + reception billing + payment ===\n");
  for (let i = 0; i < appointmentIds.length; i++) {
    const appointmentId = appointmentIds[i]!;
    const patientId = patientIds[i]!;

    await req(doctorJwt, "/api/consultations/complete", {
      method: "POST",
      body: JSON.stringify({
        clinicId: clinic_id,
        appointmentId,
        patientId,
        diagnosis: `E2E diagnosis ${i + 1}`,
        notes: `E2E notes ${i + 1}`,
        prescription: {
          items: [{ name: "Paracetamol", dosage: "500mg", frequency: "BD", duration: "3d" }],
        },
      }),
    });

    const bill = await req<{ bill?: { id?: string } }>(receptionJwt, "/api/billing", {
      method: "POST",
      body: JSON.stringify({
        clinicId: clinic_id,
        appointmentId,
        patientId,
        consultationFee: 500,
        medicineCost: 0,
      }),
    });
    const billId = bill.bill?.id;
    if (!billId) throw new Error("Bill id missing");

    await req(receptionJwt, `/api/billing/${billId}/payments`, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: "upi" }),
    });
  }

  console.log("All consultations completed and payments recorded.\n");
  console.log("OK: full e2e workflow passed.");
  console.log(`\nReuse: CLINIC_ID=${clinic_id}  DOCTOR_USER_ID=${doctorInternalId}  (tokens expire — re-login at /portal/login)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
