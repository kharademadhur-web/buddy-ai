/**
 * End-to-end check: super-admin creates a doctor + receptionist, then both log in
 * and hit queue/staff read APIs.
 *
 * Prerequisites: API reachable, Supabase configured, at least one clinic.
 *
 * Env:
 * - BASE_URL (default http://localhost:8080)
 * - ADMIN_USER_ID + ADMIN_PASSWORD — super-admin portal login
 *   OR ADMIN_TOKEN / ACCESS_TOKEN — existing JWT (skips login)
 * - CLINIC_ID (optional) — use this clinic; otherwise first from GET /api/admin/clinics
 */

import "dotenv/config";

type Json = Record<string, unknown>;

const BASE = (process.env.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const ADMIN_TOKEN_IN = process.env.ADMIN_TOKEN || process.env.ACCESS_TOKEN || "";
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const CLINIC_ID_OVERRIDE = process.env.CLINIC_ID || "";

const DEVICE_ADMIN = `verify-staff-admin-${Date.now()}`;
const DEVICE_DOC = `verify-staff-doc-${Date.now()}`;
const DEVICE_REC = `verify-staff-rec-${Date.now()}`;

function phoneSuffix(): string {
  return String(Date.now()).slice(-9);
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

async function resolveAdminToken(): Promise<string> {
  if (ADMIN_TOKEN_IN) return ADMIN_TOKEN_IN;
  if (!ADMIN_USER_ID || !ADMIN_PASSWORD) {
    console.error(`
Set either:
  ADMIN_TOKEN or ACCESS_TOKEN (JWT)
or
  ADMIN_USER_ID + ADMIN_PASSWORD (super-admin portal user_id + password)
`);
    process.exit(2);
  }
  return loginPortal(ADMIN_USER_ID, ADMIN_PASSWORD, DEVICE_ADMIN);
}

async function main() {
  console.log(`BASE_URL=${BASE}`);
  const adminToken = await resolveAdminToken();

  const clinicsRes = await jsonAuth<{ success?: boolean; clinics?: Array<{ id: string; clinic_code: string }> }>(
    adminToken,
    "/api/admin/clinics"
  );
  const clinics = clinicsRes.clinics || [];
  if (clinics.length === 0) {
    throw new Error("No clinics found. Create a clinic first (super-admin onboarding).");
  }
  const clinic = CLINIC_ID_OVERRIDE
    ? clinics.find((c) => c.id === CLINIC_ID_OVERRIDE)
    : clinics[0];
  if (!clinic) {
    throw new Error(`CLINIC_ID=${CLINIC_ID_OVERRIDE} not found in clinic list`);
  }
  const { id: clinic_id, clinic_code } = clinic;
  console.log(`Using clinic ${clinic_code} (${clinic_id})`);

  const suffix = phoneSuffix();
  const doctorPhone = `+9198${suffix}`;
  const receptionPhone = `+9197${suffix}`;

  console.log("Creating doctor…");
  const doctorRes = await jsonAuth<{
    success?: boolean;
    user?: { id: string; user_id: string; role: string };
    credentials?: { user_id: string; password: string };
  }>(adminToken, "/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: `Verify Doctor ${suffix}`,
      phone: doctorPhone,
      role: "doctor",
      clinic_id,
      clinic_code,
      license_number: `VERIFY-MED-${suffix}`,
    }),
  });
  const doctorInternalId = doctorRes.user?.id;
  const doctorUserId = doctorRes.credentials?.user_id;
  const doctorPassword = doctorRes.credentials?.password;
  if (!doctorInternalId || !doctorUserId || !doctorPassword) {
    throw new Error(`Create doctor failed: ${JSON.stringify(doctorRes)}`);
  }
  console.log(`Doctor created: user_id=${doctorUserId} (internal id=${doctorInternalId})`);

  console.log("Creating receptionist…");
  const recRes = await jsonAuth<{
    success?: boolean;
    user?: { id: string; user_id: string };
    credentials?: { user_id: string; password: string };
  }>(adminToken, "/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: `Verify Reception ${suffix}`,
      phone: receptionPhone,
      role: "receptionist",
      clinic_id,
      clinic_code,
      assigned_doctor_ids: [doctorInternalId],
    }),
  });
  const recUserId = recRes.credentials?.user_id;
  const recPassword = recRes.credentials?.password;
  if (!recUserId || !recPassword) {
    throw new Error(`Create receptionist failed: ${JSON.stringify(recRes)}`);
  }
  console.log(`Receptionist created: user_id=${recUserId}`);

  console.log("Logging in doctor + receptionist…");
  const doctorJwt = await loginPortal(doctorUserId, doctorPassword, DEVICE_DOC);
  const receptionJwt = await loginPortal(recUserId, recPassword, DEVICE_REC);

  console.log("Doctor: GET /api/queue");
  await jsonAuth(receptionJwt, `/api/staff/doctors?clinicId=${encodeURIComponent(clinic_id)}`);
  await jsonAuth(receptionJwt, `/api/queue?clinicId=${encodeURIComponent(clinic_id)}`);
  await jsonAuth(
    doctorJwt,
    `/api/queue?clinicId=${encodeURIComponent(clinic_id)}&doctorId=${encodeURIComponent(doctorInternalId)}`
  );

  console.log("");
  console.log("OK: doctor + receptionist created and API checks passed.");
  console.log(
    `One-time credentials (store securely if you need them later): doctor=${doctorUserId} / reception=${recUserId}`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
