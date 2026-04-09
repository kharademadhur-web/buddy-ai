import { Router, Request, Response } from "express";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { fetchAssignedDoctorIds } from "../services/receptionist-scope.service";
import SupabaseStorageService from "../services/supabase-storage.service";
import OtpAuthService from "../services/otp-auth.service";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();
const CLINIC_ASSETS_BUCKET = "clinic-assets";

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

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    let q = supabase
      .from("users")
      .select("id, user_id, name, role, clinic_id")
      .eq("clinic_id", clinicId)
      .in("role", ["doctor", "independent"])
      .order("name", { ascending: true });

    if (req.user?.role === "receptionist") {
      const assigned = await fetchAssignedDoctorIds(req.user);
      if (assigned.length === 0) {
        return res.json({ success: true, doctors: [] });
      }
      q = q.in("id", assigned);
    }

    const { data, error } = await q;

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, doctors: data ?? [] });
  }
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

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const { data: clinic, error } = await supabase
      .from("clinics")
      .select("id, name, phone, address, email, letterhead_storage_path, letterhead_mime, letterhead_field_map, payment_qr_storage_path")
      .eq("id", clinicId)
      .single();

    if (error || !clinic) return sendJsonError(res, 404, "Clinic not found", "NOT_FOUND");

    let letterheadSignedUrl: string | null = null;
    let paymentQrSignedUrl: string | null = null;
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
      },
      letterhead: {
        signedUrl: letterheadSignedUrl,
        mime: clinic.letterhead_mime,
        fieldMap: clinic.letterhead_field_map ?? {},
      },
      paymentQrSignedUrl,
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

