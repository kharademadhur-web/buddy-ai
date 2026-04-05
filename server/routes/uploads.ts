import { Router, Request, Response } from "express";
import multer from "multer";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { sendJsonError } from "../lib/send-json-error";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import SupabaseStorageService from "../services/supabase-storage.service";

const router = Router();

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
 * Returns a signed URL for the given bucket/path (authenticated).
 */
router.get(
  "/signed-url",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const bucket = String(req.query.bucket || "").trim();
    const path = String(req.query.path || "").trim();
    if (!bucket) throw new ValidationError("bucket is required");
    if (!path) throw new ValidationError("path is required");

    const signedUrl = await SupabaseStorageService.getSignedUrl(bucket, path);
    res.json({ success: true, signedUrl });
  })
);

export default router;

