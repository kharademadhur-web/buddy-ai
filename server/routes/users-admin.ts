import { Router, Request, Response } from "express";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireSuperAdmin, requireSuperAdminOrClinicAdmin } from "../middleware/rbac.middleware";
import {
  asyncHandler,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../middleware/error-handler.middleware";
import UserIdGeneratorService from "../services/user-id-generator.service";
import CredentialGeneratorService from "../services/credential-generator.service";
import { writeAuditLog } from "../services/audit.service";

const router = Router();

/**
 * POST /api/admin/users
 * Add a new user (doctor or receptionist) — super-admin (any clinic) or clinic-admin (own clinic only).
 */
router.post(
  "/",
  authMiddleware,
  requireSuperAdminOrClinicAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      name,
      phone,
      email,
      role,
      clinic_id,
      clinic_code,
      license_number,
      send_credentials_to,
    } = req.body;

    // Validate required fields
    if (!name || !phone || !role || !clinic_id || !clinic_code) {
      throw new ValidationError(
        "Name, phone, role, clinic_id, and clinic_code are required"
      );
    }

    if (req.user?.role === "clinic-admin") {
      if (!req.user.clinicId || clinic_id !== req.user.clinicId) {
        throw new ForbiddenError("You can only create users for your own clinic");
      }
    }

    if (!["doctor", "receptionist"].includes(role)) {
      throw new ValidationError("Role must be doctor or receptionist");
    }
    if (role === "doctor" && !license_number) {
      throw new ValidationError("license_number is required for doctor");
    }

    const supabase = getSupabaseClient();

    // Check if user with this phone already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .single();

    if (existingUser) {
      throw new ConflictError("User with this phone number already exists");
    }

    // Generate user ID
    const user_id = await UserIdGeneratorService.generateUserID(
      clinic_code,
      role
    );

    // Generate credentials
    const credentials = await CredentialGeneratorService.generateCredentials(
      user_id
    );

    // Create user
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        user_id,
        name,
        phone,
        email: email || null,
        role,
        clinic_id,
        password_hash: credentials.password_hash,
        is_active: true,
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error(`Failed to create user: ${userError?.message}`);
    }

    // Increment counter after successful user creation
    await UserIdGeneratorService.incrementUserIdCounter(clinic_code, role);

    // If doctor, create doctor profile
    if (role === "doctor") {
      const { error: doctorError } = await supabase.from("doctors").insert({
        user_id: user.id,
        license_number: license_number || null,
      });

      if (doctorError) {
        // Rollback user creation
        await supabase.from("users").delete().eq("id", user.id);
        throw new Error(`Failed to create doctor profile: ${doctorError.message}`);
      }
    }

    // If receptionist, create receptionist profile
    if (role === "receptionist") {
      const { error: recError } = await supabase.from("receptionists").insert({
        user_id: user.id,
      });

      if (recError) {
        // Rollback user creation
        await supabase.from("users").delete().eq("id", user.id);
        throw new Error(
          `Failed to create receptionist profile: ${recError.message}`
        );
      }
    }

    // Send credentials if requested
    if (send_credentials_to === "email" && email) {
      await CredentialGeneratorService.sendCredentials(
        {
          name,
          user_id,
          email,
          phone,
        },
        credentials.password,
        { method: "email" }
      );
    } else if (send_credentials_to === "sms") {
      await CredentialGeneratorService.sendCredentials(
        {
          name,
          user_id,
          email,
          phone,
        },
        credentials.password,
        { method: "sms" }
      );
    }

    // Log credential generation
    await CredentialGeneratorService.logCredentialGeneration(user.id, "created");

    await writeAuditLog({
      action: "onboarding_user_created",
      userId: req.user?.userId,
      userRole: req.user?.role,
      resourceType: "user",
      resourceId: user.id,
      changes: { created_user_id: user.id, role, clinic_id },
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        user_id: user.user_id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
      credentials: {
        user_id: credentials.user_id,
        password: credentials.password, // Show once to admin
      },
      message:
        "User created successfully. Credentials displayed above (shown only once).",
    });
  })
);

/**
 * GET /api/admin/users
 * List users by clinic
 */
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { clinic_id, role } = req.query;

    const supabase = getSupabaseClient();

    let query = supabase
      .from("users")
      .select("id, user_id, name, phone, email, role, is_active, created_at");

    const effectiveClinic =
      req.user?.role === "clinic-admin" ? req.user.clinicId : (clinic_id as string | undefined);
    if (effectiveClinic) {
      query = query.eq("clinic_id", effectiveClinic);
    }

    if (role) {
      query = query.eq("role", role as string);
    }

    if (req.user?.role === "clinic-admin" && !effectiveClinic) {
      return res.json({ success: true, users: [] });
    }

    const { data: users, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    res.json({
      success: true,
      users: users || [],
    });
  })
);

/**
 * GET /api/admin/users/:userId
 * Get user details
 */
router.get(
  "/:userId",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const supabase = getSupabaseClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`);
    }

    if (
      req.user?.role === "clinic-admin" &&
      user.clinic_id !== req.user.clinicId
    ) {
      throw new ForbiddenError("Access denied");
    }

    // Get additional profile data
    let profile = null;
    if (user.role === "doctor") {
      const { data: doctorData } = await supabase
        .from("doctors")
        .select("*")
        .eq("user_id", userId)
        .single();
      profile = doctorData;
    } else if (user.role === "receptionist") {
      const { data: recData } = await supabase
        .from("receptionists")
        .select("*")
        .eq("user_id", userId)
        .single();
      profile = recData;
    }

    res.json({
      success: true,
      user: {
        ...user,
        profile,
      },
    });
  })
);

/**
 * POST /api/admin/users/:userId/kyc-documents
 * Attach uploaded KYC document paths to doctor/receptionist profile (super-admin only)
 */
router.post(
  "/:userId/kyc-documents",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { role, documents } = req.body as {
      role?: "doctor" | "receptionist";
      documents?: { panPath?: string; aadhaarPath?: string; signaturePath?: string };
    };

    if (!role) throw new ValidationError("role is required");
    if (!documents) throw new ValidationError("documents is required");
    if (role === "doctor") {
      if (!documents.panPath) throw new ValidationError("panPath is required for doctor KYC");
      if (!documents.aadhaarPath) throw new ValidationError("aadhaarPath is required for doctor KYC");
      if (!documents.signaturePath) throw new ValidationError("signaturePath is required for doctor KYC");
    }

    const supabase = getSupabaseClient();

    const tryUpdate = async (table: string, match: Record<string, any>, patch: Record<string, any>) => {
      const { error } = await supabase.from(table).update(patch).match(match);
      if (error) {
        const msg = (error as any)?.message || JSON.stringify(error);
        throw new Error(`[${table}] update failed: ${msg}`);
      }
      return true;
    };

    let updatedProfile: any = null;

    if (role === "doctor") {
      const applied: Record<string, string> = {};
      const applyDocField = async (fieldKey: string, value: string, candidates: string[]) => {
        let lastErr: unknown = null;
        for (const col of candidates) {
          try {
            await tryUpdate("doctors", { user_id: userId }, { [col]: value } as any);
            applied[fieldKey] = col;
            return;
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr instanceof Error ? lastErr : new Error("Failed to update doctor document field");
      };

      if (documents.panPath) {
        await applyDocField("pan", documents.panPath, [
          "pan_url",
          "pan_document_url",
          "pan_card_url",
          "pan_path",
          "pan",
          "pan_encrypted",
        ]);
      }

      if (documents.aadhaarPath) {
        await applyDocField("aadhaar", documents.aadhaarPath, [
          "aadhaar_url",
          "aadhaar_document_url",
          "aadhaar_card_url",
          "aadhaar_path",
          "aadhaar",
          "aadhaar_encrypted",
        ]);
      }

      if (documents.signaturePath) {
        await applyDocField("signature", documents.signaturePath, [
          "signature_url",
          "signature_document_url",
          "signature_path",
          "signature",
        ]);
      }

      updatedProfile = { user_id: userId, applied };
    }

    if (role === "receptionist") {
      // Receptionist KYC is optional; update only if columns exist.
      try {
        await tryUpdate(
          "receptionists",
          { user_id: userId },
          {
            ...(documents.signaturePath ? { signature_url: documents.signaturePath } : {}),
            ...(documents.panPath ? { pan_url: documents.panPath } : {}),
            ...(documents.aadhaarPath ? { aadhaar_url: documents.aadhaarPath } : {}),
            updated_at: new Date().toISOString(),
          }
        );
        updatedProfile = { user_id: userId };
      } catch {
        updatedProfile = null;
      }
    }

    res.json({
      success: true,
      profile: updatedProfile,
    });
  })
);

/**
 * PUT /api/admin/users/:userId
 * Update user details
 */
router.put(
  "/:userId",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { name, email, phone, is_active } = req.body;

    const supabase = getSupabaseClient();

    const { data: user, error } = await supabase
      .from("users")
      .update({
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        is_active: is_active !== undefined ? is_active : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error || !user) {
      throw new Error(`Failed to update user: ${error?.message}`);
    }

    res.json({
      success: true,
      user,
    });
  })
);

/**
 * DELETE /api/admin/users/:userId
 * Soft delete user (deactivate)
 */
router.delete(
  "/:userId",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    res.json({
      success: true,
      message: "User deactivated successfully",
    });
  })
);

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset user password (admin operation)
 */
router.post(
  "/:userId/reset-password",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const supabase = getSupabaseClient();

    // Get user to retrieve user_id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, user_id")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`);
    }

    // Generate new credentials
    const credentials =
      await CredentialGeneratorService.generateCredentials(user.user_id);

    // Update password
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: credentials.password_hash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      throw new Error(`Failed to reset password: ${updateError.message}`);
    }

    // Log the password reset
    await CredentialGeneratorService.logCredentialGeneration(userId, "reset");

    res.json({
      success: true,
      credentials: {
        user_id: credentials.user_id,
        password: credentials.password,
      },
      message: "Password reset successfully. New credentials shown above.",
    });
  })
);

/**
 * POST /api/admin/users/:userId/reset-device
 * Reset device for user (admin operation)
 */
router.post(
  "/:userId/reset-device",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const DeviceApprovalService = (await import("../services/device-approval.service")).default;

    const success = await DeviceApprovalService.resetDevice(userId);

    if (!success) {
      return res.status(400).json({ error: "Failed to reset device" });
    }

    res.json({
      success: true,
      message: "Device reset successfully. User can login with a new device.",
    });
  })
);

export default router;
