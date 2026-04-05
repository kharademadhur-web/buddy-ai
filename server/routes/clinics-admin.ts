import { Router, Request, Response } from "express";
import multer from "multer";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireSuperAdmin, requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler, ValidationError, ConflictError, ForbiddenError } from "../middleware/error-handler.middleware";
import { generateClinicCode } from "../services/user-id-generator.service";
import SupabaseStorageService from "../services/supabase-storage.service";

const router = Router();

const CLINIC_ASSETS_BUCKET = "clinic-assets";
const uploadAsset = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

async function ensureClinicAssetsBucket() {
  const supabase = getSupabaseClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if ((buckets || []).some((b) => b.name === CLINIC_ASSETS_BUCKET)) return;
  await supabase.storage.createBucket(CLINIC_ASSETS_BUCKET, { public: false });
}

/**
 * POST /api/admin/clinics
 * Create a new clinic (super-admin only)
 */
router.post(
  "/",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, address, phone, email, clinic_code } = req.body;

    if (!name) {
      throw new ValidationError("Name is required");
    }

    const supabase = getSupabaseClient();

    const finalClinicCode = clinic_code || (await generateClinicCode(name));

    // Check if clinic code already exists
    const { data: existingClinic, error: checkError } = await supabase
      .from("clinics")
      .select("id")
      .eq("clinic_code", finalClinicCode)
      .single();

    if (checkError?.code !== "PGRST116" && existingClinic) {
      // PGRST116 means no rows found
      throw new ConflictError("Clinic code already exists");
    }

    // Create clinic
    const { data: clinic, error: createError } = await supabase
      .from("clinics")
      .insert({
        name,
        address: address || null,
        phone: phone || null,
        email: email || null,
        clinic_code: finalClinicCode,
        subscription_status: "pending",
      })
      .select()
      .single();

    if (createError || !clinic) {
      throw new Error(`Failed to create clinic: ${createError?.message}`);
    }

    res.status(201).json({
      success: true,
      clinic,
    });
  })
);

/**
 * GET /api/admin/clinics
 * List all clinics (super-admin) or single clinic (clinic-admin).
 */
router.get(
  "/",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();

    if (req.user?.role === "clinic-admin") {
      if (!req.user.clinicId) {
        return res.json({ success: true, clinics: [] });
      }
      const { data: one, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", req.user.clinicId)
        .maybeSingle();
      if (error) throw new Error(`Failed to fetch clinic: ${error.message}`);
      return res.json({
        success: true,
        clinics: one ? [{ ...one, inactiveUsersCount: 0 }] : [],
      });
    }

    const { data: clinics, error } = await supabase
      .from("clinics")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch clinics: ${error.message}`);
    }

    const clinicIds = (clinics || []).map((c: any) => c.id);
    const inactiveCountsByClinic: Record<string, number> = {};
    if (clinicIds.length > 0) {
      const { data: inactiveUsers, error: inactiveError } = await supabase
        .from("users")
        .select("clinic_id")
        .in("clinic_id", clinicIds)
        .eq("is_active", false);

      if (!inactiveError && inactiveUsers) {
        for (const row of inactiveUsers as any[]) {
          if (!row.clinic_id) continue;
          inactiveCountsByClinic[row.clinic_id] = (inactiveCountsByClinic[row.clinic_id] || 0) + 1;
        }
      }
    }

    res.json({
      success: true,
      clinics: (clinics || []).map((c: any) => ({
        ...c,
        inactiveUsersCount: inactiveCountsByClinic[c.id] || 0,
      })),
    });
  })
);

/**
 * GET /api/admin/clinics/:clinicId
 * Get clinic details
 */
router.get(
  "/:clinicId",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;

    const supabase = getSupabaseClient();

    // Verify clinic access (super-admin, clinic-admin, or matching clinic staff)
    if (req.user?.role === "clinic-admin" && req.user.clinicId !== clinicId) {
      throw new ForbiddenError("Access denied");
    }
    if (
      req.user?.role !== "super-admin" &&
      req.user?.role !== "clinic-admin" &&
      req.user?.clinicId !== clinicId
    ) {
      throw new ValidationError("Access denied");
    }

    const { data: clinic, error } = await supabase
      .from("clinics")
      .select(
        `
        *,
        users(count),
        doctors(count),
        payments(count)
      `
      )
      .eq("id", clinicId)
      .single();

    if (error || !clinic) {
      throw new Error(`Clinic not found: ${error?.message}`);
    }

    res.json({
      success: true,
      clinic,
    });
  })
);

/**
 * PUT /api/admin/clinics/:clinicId
 * Update clinic — super-admin (full) or clinic-admin (contact fields only, own clinic).
 */
router.put(
  "/:clinicId",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;
    const {
      name,
      address,
      phone,
      email,
      subscription_status,
      max_doctors,
      max_receptionists,
      letterhead_storage_path,
      letterhead_mime,
      letterhead_field_map,
      payment_qr_storage_path,
    } = req.body as Record<string, unknown>;

    if (req.user?.role === "clinic-admin") {
      if (!req.user.clinicId || req.user.clinicId !== clinicId) {
        throw new ForbiddenError("You can only update your own clinic");
      }
    }

    const supabase = getSupabaseClient();

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) patch.name = name;
    if (address !== undefined) patch.address = address;
    if (phone !== undefined) patch.phone = phone;
    if (email !== undefined) patch.email = email;
    if (req.user?.role === "super-admin" && subscription_status !== undefined) {
      patch.subscription_status = subscription_status;
    }
    if (req.user?.role === "super-admin") {
      if (max_doctors !== undefined) patch.max_doctors = max_doctors;
      if (max_receptionists !== undefined) patch.max_receptionists = max_receptionists;
      if (letterhead_storage_path !== undefined) patch.letterhead_storage_path = letterhead_storage_path;
      if (letterhead_mime !== undefined) patch.letterhead_mime = letterhead_mime;
      if (letterhead_field_map !== undefined) patch.letterhead_field_map = letterhead_field_map;
      if (payment_qr_storage_path !== undefined) patch.payment_qr_storage_path = payment_qr_storage_path;
    }

    const { data: clinic, error } = await supabase
      .from("clinics")
      .update(patch)
      .eq("id", clinicId)
      .select()
      .single();

    if (error || !clinic) {
      throw new Error(`Failed to update clinic: ${error?.message}`);
    }

    res.json({
      success: true,
      clinic,
    });
  })
);

/**
 * PUT /api/admin/clinics/:clinicId/access
 * Access controls: suspend/read-only + reason (super-admin only)
 *
 * This is schema-tolerant:
 * - prefers clinics.is_suspended/read_only/access_reason if present
 * - falls back to clinics.status or clinics.subscription_status
 */
router.put(
  "/:clinicId/access",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;
    const { is_suspended, read_only, reason } = req.body as {
      is_suspended?: boolean;
      read_only?: boolean;
      reason?: string;
    };

    const supabase = getSupabaseClient();

    const patch: any = {
      updated_at: new Date().toISOString(),
    };

    if (typeof is_suspended === "boolean") patch.is_suspended = is_suspended;
    if (typeof read_only === "boolean") patch.read_only = read_only;
    if (typeof reason === "string") patch.access_reason = reason;

    // Also maintain legacy status field(s)
    if (typeof is_suspended === "boolean") {
      patch.status = is_suspended ? "inactive" : "active";
      patch.subscription_status = is_suspended ? "inactive" : "active";
    }

    const { data: clinic, error } = await supabase
      .from("clinics")
      .update(patch)
      .eq("id", clinicId)
      .select()
      .single();

    if (error || !clinic) {
      throw new Error(`Failed to update clinic access: ${error?.message}`);
    }

    res.json({ success: true, clinic });
  })
);

/**
 * DELETE /api/admin/clinics/:clinicId
 * Soft delete clinic (super-admin only)
 * Note: We'll mark as inactive instead of hard delete
 */
router.delete(
  "/:clinicId",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("clinics")
      .update({
        subscription_status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", clinicId);

    if (error) {
      throw new Error(`Failed to delete clinic: ${error.message}`);
    }

    res.json({
      success: true,
      message: "Clinic deactivated successfully",
    });
  })
);

/**
 * GET /api/admin/clinics/:clinicId/stats
 * Get clinic statistics
 */
router.get(
  "/:clinicId/stats",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;

    const supabase = getSupabaseClient();

    // Verify access
    if (
      req.user?.role !== "super-admin" &&
      req.user?.clinicId !== clinicId
    ) {
      throw new ValidationError("Access denied");
    }

    // Get clinic stats
    const { data: userStats } = await supabase
      .from("users")
      .select("role")
      .eq("clinic_id", clinicId);

    const { data: paymentStats } = await supabase
      .from("payments")
      .select("status, amount")
      .eq("clinic_id", clinicId);

    const stats = {
      totalUsers: userStats?.length || 0,
      doctors: userStats?.filter((u) => u.role === "doctor").length || 0,
      receptionists:
        userStats?.filter((u) => u.role === "receptionist").length || 0,
      totalRevenue: paymentStats
        ?.reduce((sum, p) => sum + (p.amount || 0), 0)
        .toFixed(2) || "0.00",
      paidRevenue: paymentStats
        ?.filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + (p.amount || 0), 0)
        .toFixed(2) || "0.00",
      pendingRevenue: paymentStats
        ?.filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + (p.amount || 0), 0)
        .toFixed(2) || "0.00",
    };

    res.json({
      success: true,
      stats,
    });
  })
);

/**
 * POST /api/admin/clinics/:clinicId/clinic-asset
 * Multipart: kind=letterhead|payment_qr, file=...
 */
router.post(
  "/:clinicId/clinic-asset",
  authMiddleware,
  requireAdmin,
  uploadAsset.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;
    const kind = String(req.body?.kind || "").trim() as "letterhead" | "payment_qr";
    const file = req.file;

    if (req.user?.role === "clinic-admin" && req.user.clinicId !== clinicId) {
      throw new ForbiddenError("You can only update your own clinic");
    }
    if (!file) throw new ValidationError("file is required");
    if (kind !== "letterhead" && kind !== "payment_qr") {
      throw new ValidationError("kind must be letterhead or payment_qr");
    }

    await ensureClinicAssetsBucket();
    const uploaded = await SupabaseStorageService.uploadDocument({
      bucket: CLINIC_ASSETS_BUCKET,
      fileName: file.originalname,
      file: file.buffer,
      contentType: file.mimetype,
      prefix: `${clinicId}/${kind}`,
    });

    const supabase = getSupabaseClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (kind === "letterhead") {
      patch.letterhead_storage_path = uploaded.path;
      patch.letterhead_mime = file.mimetype;
    } else {
      patch.payment_qr_storage_path = uploaded.path;
    }

    const { data: clinic, error } = await supabase
      .from("clinics")
      .update(patch)
      .eq("id", clinicId)
      .select()
      .single();

    if (error || !clinic) {
      throw new Error(`Failed to update clinic asset: ${error?.message}`);
    }

    res.json({
      success: true,
      clinic,
      upload: { path: uploaded.path, signedUrl: uploaded.url },
    });
  })
);

/**
 * GET /api/admin/clinics/:clinicId/receptionist-assignments
 */
router.get(
  "/:clinicId/receptionist-assignments",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;
    if (req.user?.role === "clinic-admin" && req.user.clinicId !== clinicId) {
      throw new ForbiddenError("Access denied");
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("receptionist_doctor_assignments")
      .select("receptionist_user_id, doctor_user_id")
      .eq("clinic_id", clinicId);
    if (error) throw new Error(error.message);
    res.json({ success: true, assignments: data ?? [] });
  })
);

/**
 * PUT /api/admin/clinics/:clinicId/receptionist-assignments
 * Body: { rows: { receptionist_user_id, doctor_user_id }[] } — replaces all rows for this clinic.
 */
router.put(
  "/:clinicId/receptionist-assignments",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.params;
    const rows = (req.body as { rows?: Array<{ receptionist_user_id: string; doctor_user_id: string }> })
      ?.rows;
    if (!Array.isArray(rows)) throw new ValidationError("rows array is required");

    const supabase = getSupabaseClient();

    const { data: usersInClinic } = await supabase
      .from("users")
      .select("id, role")
      .eq("clinic_id", clinicId);
    const idSet = new Set((usersInClinic ?? []).map((u) => u.id));
    const receptionists = new Set(
      (usersInClinic ?? []).filter((u) => u.role === "receptionist").map((u) => u.id)
    );
    const doctors = new Set(
      (usersInClinic ?? []).filter((u) => u.role === "doctor" || u.role === "independent").map((u) => u.id)
    );

    for (const r of rows) {
      if (!receptionists.has(r.receptionist_user_id) || !doctors.has(r.doctor_user_id)) {
        throw new ValidationError("Invalid receptionist or doctor for this clinic");
      }
      if (!idSet.has(r.receptionist_user_id) || !idSet.has(r.doctor_user_id)) {
        throw new ValidationError("Invalid user id");
      }
    }

    await supabase.from("receptionist_doctor_assignments").delete().eq("clinic_id", clinicId);

    if (rows.length > 0) {
      const insertRows = rows.map((r) => ({
        clinic_id: clinicId,
        receptionist_user_id: r.receptionist_user_id,
        doctor_user_id: r.doctor_user_id,
      }));
      const { error: insErr } = await supabase.from("receptionist_doctor_assignments").insert(insertRows);
      if (insErr) throw new Error(insErr.message);
    }

    res.json({ success: true });
  })
);

export default router;
