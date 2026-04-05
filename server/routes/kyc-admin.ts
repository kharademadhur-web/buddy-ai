import { Router, Request, Response } from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireSuperAdmin } from "../middleware/rbac.middleware";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { getSupabaseClient } from "../config/supabase";
import SupabaseStorageService from "../services/supabase-storage.service";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

async function ensureKycBucketExists() {
  const supabase = getSupabaseClient();
  const bucketName = "kyc-documents";

  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.name === bucketName);
  if (exists) return;

  // Best-effort: create as private
  await supabase.storage.createBucket(bucketName, { public: false });
}

async function logAudit(req: Request, action: string, resource_type: string, resource_id: string, changes?: any, status: "success" | "failure" = "success", error_message?: string) {
  const supabase = getSupabaseClient();
  try {
    await supabase.from("audit_logs").insert({
      action,
      user_id: req.user?.userId ?? null,
      user_role: req.user?.role ?? null,
      resource_type,
      resource_id,
      changes: changes ?? null,
      ip_address: req.ip ?? null,
      user_agent: req.headers["user-agent"] ?? null,
      status,
      error_message: error_message ?? null,
    });
  } catch {
    // Best-effort auditing only
  }
}

/**
 * POST /api/admin/kyc/upload
 * Multipart upload of a single KYC document (super-admin only)
 *
 * Form fields:
 * - userId (required): UUID of the user (users.id) to namespace storage path
 * - file (required): the document file
 */
router.post(
  "/upload",
  authMiddleware,
  requireSuperAdmin,
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.body.userId || "").trim();
    const file = req.file;

    if (!userId) throw new ValidationError("userId is required");
    if (!file) throw new ValidationError("file is required");

    await ensureKycBucketExists();

    const validation = SupabaseStorageService.validateFile(file.buffer, file.originalname);
    if (!validation.valid) throw new ValidationError(validation.error || "Invalid file");

    const uploaded = await SupabaseStorageService.uploadDocument({
      bucket: "kyc-documents",
      fileName: file.originalname,
      file: file.buffer,
      contentType: file.mimetype,
      prefix: userId,
    });

    res.status(201).json({ success: true, document: uploaded });
  })
);

/**
 * POST /api/admin/kyc/signed-url
 * Generate a signed URL (super-admin only)
 */
router.post(
  "/signed-url",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { path, bucket } = req.body as { path?: string; bucket?: string };
    if (!path) throw new ValidationError("path is required");
    const finalBucket = bucket || "kyc-documents";

    const signedUrl = await SupabaseStorageService.getSignedUrl(finalBucket, path);
    res.json({ success: true, signedUrl });
  })
);

/**
 * GET /api/admin/kyc/doctors
 * List doctors for KYC review (super-admin only)
 */
router.get(
  "/doctors",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const status = String(req.query.status || "pending");
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("doctors")
      .select("*, users(id, user_id, name, clinic_id, role, is_active, created_at)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch doctors: ${error.message}`);

    const rows = (data || []).map((d: any) => {
      const hasDocs = Boolean(
        d.signature_url ||
          d.signature_path ||
          d.signature ||
          d.aadhaar_url ||
          d.aadhaar_path ||
          d.aadhaar ||
          d.aadhaar_encrypted ||
          d.pan_url ||
          d.pan_path ||
          d.pan ||
          d.pan_encrypted
      );
      return {
        id: d.id,
        userId: d.user_id,
        licenseNumber: d.license_number,
        hasDocuments: hasDocs,
        user: d.users,
      };
    });

    const filtered =
      status === "all"
        ? rows
        : status === "pending"
          ? rows.filter((r) => r.hasDocuments)
          : rows;

    res.json({ success: true, doctors: filtered });
  })
);

/**
 * GET /api/admin/kyc/doctor/:userId
 * Fetch doctor KYC docs and return signed URLs (super-admin only)
 */
router.get(
  "/doctor/:userId",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const supabase = getSupabaseClient();

    const { data: doctor, error } = await supabase
      .from("doctors")
      .select("*, users(id, user_id, name, clinic_id, role)")
      .eq("user_id", userId)
      .single();

    if (error || !doctor) throw new Error(`Doctor not found: ${error?.message || "unknown"}`);

    const docs: Record<string, { path: string; signedUrl: string } | null> = {
      aadhaar: null,
      pan: null,
      signature: null,
    };

    const maybeSign = async (path?: string | null) => {
      if (!path) return null;
      const signedUrl = await SupabaseStorageService.getSignedUrl("kyc-documents", path);
      return { path, signedUrl };
    };

    const pick = (obj: any, keys: string[]) => {
      for (const k of keys) {
        if (obj?.[k]) return obj[k] as string;
      }
      return null;
    };

    docs.aadhaar = await maybeSign(
      pick(doctor, [
        "aadhaar_url",
        "aadhaar_document_url",
        "aadhaar_card_url",
        "aadhaar_path",
        "aadhaar",
        "aadhaar_encrypted",
      ])
    );
    docs.pan = await maybeSign(
      pick(doctor, [
        "pan_url",
        "pan_document_url",
        "pan_card_url",
        "pan_path",
        "pan",
        "pan_encrypted",
      ])
    );
    docs.signature = await maybeSign(
      pick(doctor, ["signature_url", "signature_document_url", "signature_path", "signature"])
    );

    res.json({
      success: true,
      doctor: {
        id: doctor.id,
        userId: doctor.user_id,
        licenseNumber: doctor.license_number,
        user: doctor.users,
      },
      documents: docs,
    });
  })
);

/**
 * POST /api/admin/kyc/doctor/:userId/approve
 */
router.post(
  "/doctor/:userId/approve",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { note } = req.body as { note?: string };
    const supabase = getSupabaseClient();

    try {
      // Best-effort: if schema has KYC status fields, update them
      await supabase
        .from("doctors")
        .update({
          kyc_status: "approved",
          kyc_reviewed_at: new Date().toISOString(),
          kyc_review_note: note || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", userId);

      await logAudit(req, "kyc_approved", "doctor", userId, { note });
    } catch (e: any) {
      await logAudit(req, "kyc_approved", "doctor", userId, { note }, "failure", String(e?.message || e));
    }

    res.json({ success: true });
  })
);

/**
 * POST /api/admin/kyc/doctor/:userId/reject
 */
router.post(
  "/doctor/:userId/reject",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { reason } = req.body as { reason?: string };
    const supabase = getSupabaseClient();

    if (!reason) throw new ValidationError("reason is required");

    try {
      await supabase
        .from("doctors")
        .update({
          kyc_status: "rejected",
          kyc_reviewed_at: new Date().toISOString(),
          kyc_review_note: reason,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", userId);

      await logAudit(req, "kyc_rejected", "doctor", userId, { reason });
    } catch (e: any) {
      await logAudit(req, "kyc_rejected", "doctor", userId, { reason }, "failure", String(e?.message || e));
    }

    res.json({ success: true });
  })
);

export default router;

