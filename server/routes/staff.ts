import { Router, Request, Response } from "express";
import multer from "multer";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { fetchAssignedDoctorIds } from "../services/receptionist-scope.service";
import SupabaseStorageService from "../services/supabase-storage.service";
import OtpAuthService from "../services/otp-auth.service";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();
const CLINIC_ASSETS_BUCKET = "clinic-assets";

/** Doctors are "online" if they sent a heartbeat within this window. */
const PRESENCE_ONLINE_MS = 120_000;

const uploadPaymentQr = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

async function ensureClinicAssetsBucket() {
  const supabase = getSupabaseClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if ((buckets || []).some((b) => b.name === CLINIC_ASSETS_BUCKET)) return;
  await supabase.storage.createBucket(CLINIC_ASSETS_BUCKET, { public: false });
}

/**
 * GET /api/staff/doctors
 * List doctors for the current clinic (reception uses this to book).
 */
router.get(
  "/doctors",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as any).clinicId || req.user?.clinicId;
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    // Service-role client: RLS only allows each user to SELECT their own `users` row, so
    // receptionists/doctors cannot list colleague doctors via the RLS JWT client. Clinic
    // scope is enforced above; optional assignment filter below narrows receptionists.
    const supabase = getSupabaseClient();

    const buildQuery = (select: string) => {
      let q = supabase
        .from("users")
        .select(select)
        .eq("clinic_id", clinicId)
        .in("role", ["doctor", "independent"])
        .order("name", { ascending: true });
      return q;
    };

    let q = buildQuery("id, user_id, name, role, clinic_id, last_portal_heartbeat_at");

    if (req.user?.role === "receptionist") {
      const assigned = await fetchAssignedDoctorIds(req.user);
      // If admin has not created assignments yet, show all doctors in the clinic (same-clinic scope).
      if (assigned.length > 0) {
        q = q.in("id", assigned);
      }
    }

    let { data, error } = await q;

    // Migration 019 not applied yet — column missing
    if (error && /last_portal|column|does not exist|schema cache/i.test(error.message)) {
      q = buildQuery("id, user_id, name, role, clinic_id");
      if (req.user?.role === "receptionist") {
        const assigned = await fetchAssignedDoctorIds(req.user);
        if (assigned.length > 0) q = q.in("id", assigned);
      }
      const r2 = await q;
      data = r2.data;
      error = r2.error;
    }

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    const now = Date.now();
    const rows = (data ?? ([] as unknown[])).map((d) => {
      const row = d as Record<string, unknown>;
      const raw = row.last_portal_heartbeat_at;
      const ts = raw ? new Date(String(raw)).getTime() : NaN;
      const online = Number.isFinite(ts) && now - ts < PRESENCE_ONLINE_MS;
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        role: row.role,
        clinic_id: row.clinic_id,
        online,
      };
    });
    const onlineDoctors = rows.filter((r: { online?: boolean }) => r.online);
    const offlineDoctors = rows.filter((r: { online?: boolean }) => !r.online);
    const doctorsSorted = [...onlineDoctors, ...offlineDoctors];
    return res.json({
      success: true,
      doctors: doctorsSorted,
      onlineDoctors,
      offlineDoctors,
    });
  }
);

/**
 * POST /api/staff/presence-heartbeat
 * Doctor / independent (and optional reception) — marks portal session so reception sees "online".
 */
router.post(
  "/presence-heartbeat",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendJsonError(res, 401, "Unauthorized", "UNAUTHORIZED");
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({ last_portal_heartbeat_at: now, updated_at: now })
      .eq("id", req.user.userId);
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    res.json({ success: true, at: now });
  })
);

/**
 * POST /api/staff/me/payment-qr
 * Multipart file — solo doctor / independent (or any staff) personal UPI QR stored on users row.
 */
router.post(
  "/me/payment-qr",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin", "clinic-admin"),
  uploadPaymentQr.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw new ValidationError("file is required");
    if (!req.user) return sendJsonError(res, 401, "Unauthorized", "UNAUTHORIZED");
    await ensureClinicAssetsBucket();
    const uploaded = await SupabaseStorageService.uploadDocument({
      bucket: CLINIC_ASSETS_BUCKET,
      fileName: file.originalname,
      file: file.buffer,
      contentType: file.mimetype,
      prefix: `${req.user.userId}/payment_qr`,
    });
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({
        payment_qr_storage_path: uploaded.path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.user.userId);
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    res.json({ success: true, path: uploaded.path });
  })
);

/**
 * GET /api/staff/clinic/letterhead-active?clinicId=
 * Signed URL + field map for mobile/tablet letterhead overlay.
 */
router.get(
  "/clinic/letterhead-active",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId?: string }).clinicId || req.user?.clinicId;
    if (!clinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();

    const { data: clinic, error } = await supabase
      .from("clinics")
      .select(
        "id, name, phone, address, email, clinic_code, letterhead_storage_path, letterhead_mime, letterhead_field_map, payment_qr_storage_path"
      )
      .eq("id", clinicId)
      .single();

    if (error || !clinic) return sendJsonError(res, 404, "Clinic not found", "NOT_FOUND");

    let letterheadSignedUrl: string | null = null;
    let paymentQrSignedUrl: string | null = null;
    let userPaymentQrSignedUrl: string | null = null;
    try {
      if (clinic.letterhead_storage_path) {
        letterheadSignedUrl = await SupabaseStorageService.getSignedUrl(
          CLINIC_ASSETS_BUCKET,
          clinic.letterhead_storage_path,
          3600
        );
      }
      if (clinic.payment_qr_storage_path) {
        paymentQrSignedUrl = await SupabaseStorageService.getSignedUrl(
          CLINIC_ASSETS_BUCKET,
          clinic.payment_qr_storage_path,
          3600
        );
      }
      const ures = await supabase
        .from("users")
        .select("payment_qr_storage_path")
        .eq("id", req.user!.userId)
        .maybeSingle();
      if (!ures.error && ures.data?.payment_qr_storage_path) {
        userPaymentQrSignedUrl = await SupabaseStorageService.getSignedUrl(
          CLINIC_ASSETS_BUCKET,
          ures.data.payment_qr_storage_path,
          3600
        );
      }
    } catch {
      /* bucket missing or path invalid */
    }

    return res.json({
      success: true,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        phone: clinic.phone,
        address: clinic.address,
        email: clinic.email,
        clinic_code: (clinic as { clinic_code?: string }).clinic_code ?? null,
      },
      letterhead: {
        signedUrl: letterheadSignedUrl,
        mime: clinic.letterhead_mime,
        fieldMap: clinic.letterhead_field_map ?? {},
      },
      paymentQrSignedUrl,
      userPaymentQrSignedUrl,
    });
  }
);

/**
 * POST /api/staff/verify-patient-phone-otp
 * Reception proves patient phone via OTP (no login tokens). Use otpSessionId on POST /api/patients.
 */
router.post(
  "/verify-patient-phone-otp",
  authMiddleware,
  requireRole("receptionist", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, otp } = req.body as { sessionId?: string; otp?: string };
    if (!sessionId || !otp) throw new ValidationError("sessionId and otp are required");
    const result = await OtpAuthService.verifyPhoneOtpForPatientProof(sessionId, otp);
    res.json({ success: true, phone: result.phone });
  })
);

export default router;

