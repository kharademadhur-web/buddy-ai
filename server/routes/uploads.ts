import { Router, Request, Response } from "express";
import multer from "multer";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { sendJsonError } from "../lib/send-json-error";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import SupabaseStorageService from "../services/supabase-storage.service";
import { createNotification } from "../services/app-notifications.service";

const router = Router();

const REPORT_UPLOAD_ROLES = [
  "doctor",
  "independent",
  "receptionist",
  "clinic-admin",
  "super-admin",
] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const REPORTS_BUCKET = "reports";

async function ensureBucketExists(bucketName: string, isPublic: boolean = false) {
  const supabase = getSupabaseClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.name === bucketName);
  if (exists) return;
  await supabase.storage.createBucket(bucketName, { public: isPublic });
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * POST /api/uploads/report
 * Upload a diagnostic report to Supabase Storage + save metadata in DB.
 *
 * Multipart fields:
 * - file (required)
 * - type (required): report type (xray/mri/ecg/...)
 * - patientId (optional)
 */
router.post(
  "/report",
  authMiddleware,
  requireRole(...REPORT_UPLOAD_ROLES),
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    const type = String(req.body.type || "").trim();
    const patientId = req.body.patientId ? String(req.body.patientId).trim() : null;

    if (!file) throw new ValidationError("file is required");
    if (!type) throw new ValidationError("type is required");

    await ensureBucketExists(REPORTS_BUCKET, false);

    const userId = req.user?.userId;
    const clinicId = req.user?.clinicId || "independent";
    if (!userId) throw new ValidationError("Unauthenticated");

    const prefix = `${safePathSegment(clinicId)}/${safePathSegment(userId)}`;

    const uploaded = await SupabaseStorageService.uploadDocument({
      bucket: REPORTS_BUCKET,
      fileName: file.originalname,
      file: file.buffer,
      contentType: file.mimetype,
      prefix,
    });

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : req.user?.clinicId
          ? getSupabaseRlsClient(signSupabaseRlsJwt(req.user))
          : getSupabaseClient();
    const { data: docRow, error } = await supabase
      .from("documents")
      .insert({
        bucket: uploaded.bucket,
        path: uploaded.path,
        file_name: uploaded.fileName,
        content_type: file.mimetype,
        size_bytes: file.size,
        document_type: type,
        patient_id: patientId,
        clinic_id: req.user?.clinicId ?? null,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      // Best-effort cleanup if metadata insert fails
      await SupabaseStorageService.deleteDocument(uploaded.bucket, uploaded.path);
      throw new Error(`Failed to save document metadata: ${error.message}`);
    }

    if (patientId && req.user?.clinicId) {
      const admin = getSupabaseClient();
      const { data: activeAppointment } = await admin
        .from("appointments")
        .select("id, doctor_user_id")
        .eq("clinic_id", req.user.clinicId)
        .eq("patient_id", patientId)
        .in("status", ["checked_in", "in_consultation"])
        .order("appointment_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeAppointment?.doctor_user_id) {
        void createNotification({
          userId: activeAppointment.doctor_user_id,
          clinicId: req.user.clinicId,
          type: "report_uploaded",
          title: "Diagnostic report uploaded",
          message: "A new report was uploaded for your patient.",
          data: {
            patientId,
            appointmentId: activeAppointment.id,
            documentId: docRow.id,
          },
        });
      }
    }

    res.status(201).json({
      success: true,
      document: {
        ...docRow,
        signedUrl: uploaded.url,
      },
    });
  })
);

/**
 * GET /api/uploads/documents?patientId=&clinicId=
 * List document metadata for a patient (RLS for staff).
 */
router.get(
  "/documents",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = String(req.query.patientId || "").trim();
    const clinicId = (req.query.clinicId as string) || req.user?.clinicId;
    if (!patientId) throw new ValidationError("patientId is required");
    if (!clinicId) throw new ValidationError("clinicId is required");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const withUrls = await Promise.all(
      (data || []).map(async (row: Record<string, unknown>) => {
        const bucket = String(row.bucket || REPORTS_BUCKET);
        const path = String(row.path || "");
        let signedUrl: string | null = null;
        try {
          signedUrl = await SupabaseStorageService.getSignedUrl(bucket, path, 3600);
        } catch {
          signedUrl = null;
        }
        return { ...row, signedUrl };
      })
    );

    res.json({ success: true, documents: withUrls });
  })
);

/**
 * GET /api/uploads/signed-url?bucket=reports&path=...
 * Returns a signed URL for the given bucket/path.
 *
 * Authorization rules (closed by default):
 *  - super-admin can sign any path.
 *  - All other authenticated roles may only sign paths whose first segment matches
 *    their JWT clinicId. This prevents IDOR / cross-clinic access by guessing paths.
 *  - Path traversal segments ("..") are rejected.
 *
 * Additionally, an authenticated user must be able to read the document row in
 * `documents` table for paths that belong to a clinic they do not own — but since
 * we already constrain by clinicId prefix, the simpler authorization above is
 * sufficient for the current bucket layout (`<clinicId>/<userId>/<file>` for
 * reports and `letterhead/<clinicId>/...` / `<clinicId>/...` for clinic assets).
 */
router.get(
  "/signed-url",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const bucket = String(req.query.bucket || "").trim();
    const path = String(req.query.path || "").trim();
    if (!bucket) throw new ValidationError("bucket is required");
    if (!path) throw new ValidationError("path is required");
    if (path.split("/").some((seg) => seg === "..")) {
      return sendJsonError(res, 400, "Invalid path", "VALIDATION_ERROR");
    }

    if (req.user?.role !== "super-admin") {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return sendJsonError(res, 403, "Clinic access required", "FORBIDDEN");
      }
      // Accept both layouts: "<clinicId>/..." and "letterhead/<clinicId>/..."
      const segments = path.split("/").filter(Boolean);
      const firstSeg = segments[0] ?? "";
      const secondSeg = segments[1] ?? "";
      const matchesDirect = firstSeg === clinicId;
      const matchesPrefixed =
        ["letterhead", "payment_qr", "kyc"].includes(firstSeg) && secondSeg === clinicId;
      if (!matchesDirect && !matchesPrefixed) {
        return sendJsonError(res, 403, "Path not in your clinic scope", "FORBIDDEN");
      }
    }

    const signedUrl = await SupabaseStorageService.getSignedUrl(bucket, path);
    res.json({ success: true, signedUrl });
  })
);

export default router;

