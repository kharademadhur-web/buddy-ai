import { Router, Request, Response } from "express";
import Razorpay from "razorpay";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole, requireSuperAdmin } from "../middleware/rbac.middleware";
import { asyncHandler, ForbiddenError, ValidationError } from "../middleware/error-handler.middleware";
import { sendJsonError } from "../lib/send-json-error";
import UserIdGeneratorService from "../services/user-id-generator.service";
import CredentialGeneratorService from "../services/credential-generator.service";
import type { GeneratedCredentials } from "../services/credential-generator.service";
import { createNotification, notifyMultiple } from "../services/app-notifications.service";
import { sendStaffEmail, sendStaffEmailToMany } from "../services/outbound-email.service";
import { writeAuditLog } from "../services/audit.service";

const router = Router();
const STAFF_SLOT_AMOUNT_PAISE = 250000;

type StaffRole = "doctor" | "receptionist";

type StaffSlotRequest = {
  id: string;
  clinic_id: string;
  requested_by: string;
  staff_role: StaffRole;
  staff_name: string;
  staff_email: string;
  staff_phone: string;
  payment_status: "pending" | "paid" | "failed";
  approval_status: "awaiting_payment" | "pending_admin" | "approved" | "rejected";
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  refund_id: string | null;
  amount: number;
  rejection_reason: string | null;
  created_user_id: string | null;
  created_user_login: string | null;
  created_at: string;
  approved_at: string | null;
  activated_at: string | null;
  clinics?: { id: string; name: string; clinic_code: string; email?: string | null } | null;
};

function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function assertClinicAdmin(req: Request): string {
  if (req.user?.role !== "clinic-admin") {
    throw new ForbiddenError("Clinic admin access required");
  }
  if (!req.user.clinicId) {
    throw new ForbiddenError("No clinic assigned");
  }
  return req.user.clinicId;
}

async function notifySuperAdmins(input: {
  clinicId: string;
  clinicName: string;
  requestId: string;
  staffName: string;
  staffRole: StaffRole;
}) {
  const supabase = getSupabaseClient();
  const { data: admins } = await supabase
    .from("users")
    .select("id, email")
    .eq("role", "super-admin")
    .eq("is_active", true);

  const adminIds = (admins ?? []).map((a: any) => a.id).filter(Boolean);
  if (adminIds.length > 0) {
    await notifyMultiple(adminIds, {
      clinicId: input.clinicId,
      type: "staff_slot_request",
      title: "New staff slot request",
      message: `New staff slot request from ${input.clinicName} — ₹2,500 received`,
      data: {
        requestId: input.requestId,
        staffName: input.staffName,
        staffRole: input.staffRole,
        href: "/admin-dashboard/staff-requests",
      },
    });
  }

  const emails = (admins ?? []).map((a: any) => a.email).filter(Boolean);
  if (emails.length > 0) {
    await sendStaffEmailToMany(emails, {
      subject: `New staff slot payment received from ${input.clinicName}`,
      text: [
        `A clinic has paid for a new staff slot.`,
        ``,
        `Clinic: ${input.clinicName}`,
        `Staff: ${input.staffName}`,
        `Role: ${input.staffRole}`,
        `Amount: ₹2,500`,
        ``,
        `Open Staff Slot Requests in the admin dashboard to approve or reject this request.`,
      ].join("\n"),
    });
  }
}

async function notifyClinicAdmins(input: {
  clinicId: string;
  type: "staff_slot_approved" | "staff_slot_rejected";
  title: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  const supabase = getSupabaseClient();
  const { data: clinicAdmins } = await supabase
    .from("users")
    .select("id")
    .eq("clinic_id", input.clinicId)
    .eq("role", "clinic-admin")
    .eq("is_active", true);

  const ids = (clinicAdmins ?? []).map((u: any) => u.id).filter(Boolean);
  if (ids.length > 0) {
    await notifyMultiple(ids, {
      clinicId: input.clinicId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? { href: "/admin-dashboard/users" },
    });
  }
}

async function createStaffAccount(input: {
  clinicId: string;
  staffRole: StaffRole;
  name: string;
  phone: string;
  email: string;
}): Promise<{ user: { id: string; user_id: string; name: string; phone: string; email: string | null; role: string }; credentials: GeneratedCredentials }> {
  const supabase = getSupabaseClient();
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, clinic_code, max_doctors, max_receptionists")
    .eq("id", input.clinicId)
    .maybeSingle();

  if (clinicError || !clinic) {
    throw new ValidationError("Clinic not found");
  }

  const { data: existingPhone } = await supabase
    .from("users")
    .select("id")
    .eq("phone", input.phone)
    .eq("clinic_id", input.clinicId)
    .maybeSingle();

  if (existingPhone) {
    throw new ValidationError("A user with this phone number already exists in this clinic");
  }

  const { data: existingEmail } = await supabase
    .from("users")
    .select("id")
    .eq("email", input.email)
    .eq("clinic_id", input.clinicId)
    .maybeSingle();

  if (existingEmail) {
    throw new ValidationError("A user with this email already exists in this clinic");
  }

  const { count: doctorLikeCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", input.clinicId)
    .in("role", ["doctor", "independent"]);

  const { count: receptionistCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", input.clinicId)
    .eq("role", "receptionist");

  if (input.staffRole === "doctor" && (clinic as any).max_doctors != null && (doctorLikeCount ?? 0) >= (clinic as any).max_doctors) {
    throw new ValidationError(`Clinic has reached the maximum of ${(clinic as any).max_doctors} doctors`);
  }
  if (input.staffRole === "receptionist" && (clinic as any).max_receptionists != null && (receptionistCount ?? 0) >= (clinic as any).max_receptionists) {
    throw new ValidationError(`Clinic has reached the maximum of ${(clinic as any).max_receptionists} receptionists`);
  }

  let user: any;
  let credentials: GeneratedCredentials | undefined;
  let forceScanAllocator = false;
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const userId = forceScanAllocator
      ? await UserIdGeneratorService.generateUserIdUniqueByScan((clinic as any).clinic_code, input.clinicId, input.staffRole)
      : await UserIdGeneratorService.generateUserID((clinic as any).clinic_code, input.clinicId, input.staffRole);
    credentials = await CredentialGeneratorService.generateCredentials(userId);

    const { data: created, error } = await supabase
      .from("users")
      .insert({
        user_id: userId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        role: input.staffRole,
        clinic_id: input.clinicId,
        password_hash: credentials.password_hash,
        is_active: true,
      })
      .select("id, user_id, name, phone, email, role")
      .single();

    if (!error && created) {
      user = created;
      break;
    }

    if (UserIdGeneratorService.isDuplicateUserIdConstraintError(error) && attempt < maxAttempts - 1) {
      forceScanAllocator = true;
      await UserIdGeneratorService.repairCounterFromExistingUserIds(
        (clinic as any).clinic_code,
        input.clinicId,
        input.staffRole
      );
      continue;
    }

    throw new Error(`Failed to create user: ${error?.message ?? "unknown"}`);
  }

  if (!user || !credentials) {
    throw new Error("Failed to generate staff credentials");
  }

  if (input.staffRole === "doctor") {
    const { error } = await supabase.from("doctors").insert({
      user_id: user.id,
      license_number: null,
    });
    if (error) {
      await supabase.from("users").delete().eq("id", user.id);
      throw new Error(`Failed to create doctor profile: ${error.message}`);
    }

    const { data: receptionists } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", input.clinicId)
      .eq("role", "receptionist");
    const assignments = (receptionists ?? []).map((r: any) => ({
      clinic_id: input.clinicId,
      receptionist_user_id: r.id,
      doctor_user_id: user.id,
    }));
    if (assignments.length > 0) {
      const { error: assignError } = await supabase
        .from("receptionist_doctor_assignments")
        .upsert(assignments, { onConflict: "receptionist_user_id,doctor_user_id,clinic_id" });
      if (assignError) {
        await supabase.from("doctors").delete().eq("user_id", user.id);
        await supabase.from("users").delete().eq("id", user.id);
        throw new Error(`Failed to link receptionists to new doctor: ${assignError.message}`);
      }
    }
  } else {
    const { error } = await supabase.from("receptionists").insert({ user_id: user.id });
    if (error) {
      await supabase.from("users").delete().eq("id", user.id);
      throw new Error(`Failed to create receptionist profile: ${error.message}`);
    }

    const { data: doctors } = await supabase
      .from("users")
      .select("id")
      .eq("clinic_id", input.clinicId)
      .in("role", ["doctor", "independent"]);
    const assignments = (doctors ?? []).map((d: any) => ({
      clinic_id: input.clinicId,
      receptionist_user_id: user.id,
      doctor_user_id: d.id,
    }));
    if (assignments.length > 0) {
      const { error: assignError } = await supabase
        .from("receptionist_doctor_assignments")
        .upsert(assignments, { onConflict: "receptionist_user_id,doctor_user_id,clinic_id" });
      if (assignError) {
        await supabase.from("receptionists").delete().eq("user_id", user.id);
        await supabase.from("users").delete().eq("id", user.id);
        throw new Error(`Failed to assign doctors to receptionist: ${assignError.message}`);
      }
    }
  }

  await CredentialGeneratorService.logCredentialGeneration(user.id, "created");
  return { user, credentials };
}

router.post(
  "/clinic/staff-requests/initiate",
  authMiddleware,
  requireRole("clinic-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = assertClinicAdmin(req);
    const staffRole = cleanString((req.body as any).staffRole) as StaffRole;
    const staffName = cleanString((req.body as any).staffName);
    const staffEmail = cleanString((req.body as any).staffEmail).toLowerCase();
    const staffPhone = cleanString((req.body as any).staffPhone);

    if (staffRole !== "doctor" && staffRole !== "receptionist") {
      throw new ValidationError("staffRole must be doctor or receptionist");
    }
    if (!staffName || !staffEmail || !staffPhone) {
      throw new ValidationError("staffName, staffEmail, and staffPhone are required");
    }

    const rzp = getRazorpay();
    if (!rzp) {
      return sendJsonError(res, 503, "Online staff slot payment is not configured", "PAYMENTS_DISABLED");
    }

    const supabase = getSupabaseClient();
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("id, name, clinic_code")
      .eq("id", clinicId)
      .maybeSingle();
    if (clinicError || !clinic) {
      return sendJsonError(res, 404, "Clinic not found", "NOT_FOUND");
    }

    const { data: request, error: insertError } = await supabase
      .from("staff_slot_requests")
      .insert({
        clinic_id: clinicId,
        requested_by: req.user?.userId,
        staff_role: staffRole,
        staff_name: staffName,
        staff_email: staffEmail,
        staff_phone: staffPhone,
        payment_status: "pending",
        approval_status: "awaiting_payment",
        amount: STAFF_SLOT_AMOUNT_PAISE,
      })
      .select("id")
      .single();
    if (insertError || !request) {
      throw new Error(`Failed to create staff request: ${insertError?.message ?? "unknown"}`);
    }

    const order = await rzp.orders.create({
      amount: STAFF_SLOT_AMOUNT_PAISE,
      currency: "INR",
      receipt: `staff_${String(request.id).slice(0, 8)}_${Date.now()}`,
      notes: {
        kind: "staff_slot_request",
        clinicId,
        requestId: request.id,
        staffRole,
      },
    });

    const { error: orderError } = await supabase
      .from("staff_slot_requests")
      .update({ razorpay_order_id: order.id })
      .eq("id", request.id);
    if (orderError) {
      throw new Error(`Failed to attach payment order: ${orderError.message}`);
    }

    res.status(201).json({
      success: true,
      requestId: request.id,
      razorpayOrderId: order.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: STAFF_SLOT_AMOUNT_PAISE,
      currency: order.currency || "INR",
      clinicName: (clinic as any).name,
    });
  })
);

router.post(
  "/clinic/staff-requests/verify-payment",
  authMiddleware,
  requireRole("clinic-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = assertClinicAdmin(req);
    const { requestId, razorpayPaymentId, razorpaySignature, razorpayOrderId } = req.body as {
      requestId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      razorpayOrderId?: string;
    };
    if (!requestId || !razorpayPaymentId || !razorpaySignature || !razorpayOrderId) {
      throw new ValidationError("requestId, razorpayPaymentId, razorpaySignature, and razorpayOrderId are required");
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return sendJsonError(res, 503, "Online staff slot payment is not configured", "PAYMENTS_DISABLED");
    }

    const crypto = await import("crypto");
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    if (expected !== razorpaySignature) {
      return sendJsonError(res, 400, "Invalid payment signature", "INVALID_SIGNATURE");
    }

    const supabase = getSupabaseClient();
    const { data: request, error } = await supabase
      .from("staff_slot_requests")
      .select("*, clinics(id, name, clinic_code)")
      .eq("id", requestId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (error || !request) {
      return sendJsonError(res, 404, "Staff request not found", "NOT_FOUND");
    }

    const row = request as StaffSlotRequest;
    if (row.razorpay_order_id !== razorpayOrderId) {
      return sendJsonError(res, 400, "Payment order mismatch", "INVALID_ORDER");
    }
    if (row.payment_status === "paid" && row.approval_status === "pending_admin") {
      return res.json({ success: true, requestId, alreadyProcessed: true });
    }

    const { error: updateError } = await supabase
      .from("staff_slot_requests")
      .update({
        payment_status: "paid",
        approval_status: "pending_admin",
        razorpay_payment_id: razorpayPaymentId,
      })
      .eq("id", requestId);
    if (updateError) {
      throw new Error(`Failed to record payment: ${updateError.message}`);
    }

    const clinicName = row.clinics?.name ?? "Clinic";
    await notifySuperAdmins({
      clinicId,
      clinicName,
      requestId,
      staffName: row.staff_name,
      staffRole: row.staff_role,
    });

    res.json({ success: true, requestId });
  })
);

router.get(
  "/clinic/staff-requests",
  authMiddleware,
  requireRole("clinic-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const clinicId = assertClinicAdmin(req);
    const { data, error } = await getSupabaseClient()
      .from("staff_slot_requests")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to fetch staff requests: ${error.message}`);
    res.json({ success: true, requests: data ?? [] });
  })
);

router.get(
  "/admin/staff-requests",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, clinicId, from, to } = req.query;
    let query = getSupabaseClient()
      .from("staff_slot_requests")
      .select("*, clinics(id, name, clinic_code, email)")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("approval_status", String(status));
    if (clinicId) query = query.eq("clinic_id", String(clinicId));
    if (from) query = query.gte("created_at", String(from));
    if (to) query = query.lte("created_at", String(to));

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch staff requests: ${error.message}`);
    res.json({ success: true, requests: data ?? [] });
  })
);

router.post(
  "/admin/staff-requests/:requestId/approve",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabaseClient();
    const { requestId } = req.params;
    const { data: request, error } = await supabase
      .from("staff_slot_requests")
      .select("*, clinics(id, name, clinic_code)")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !request) return sendJsonError(res, 404, "Staff request not found", "NOT_FOUND");

    const row = request as StaffSlotRequest;
    if (row.payment_status !== "paid" || row.approval_status !== "pending_admin") {
      return sendJsonError(res, 400, "Only paid requests pending admin review can be approved", "INVALID_STATUS");
    }

    const result = await createStaffAccount({
      clinicId: row.clinic_id,
      staffRole: row.staff_role,
      name: row.staff_name,
      phone: row.staff_phone,
      email: row.staff_email,
    });

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("staff_slot_requests")
      .update({
        approval_status: "approved",
        approved_at: now,
        activated_at: now,
        created_user_id: result.user.id,
        created_user_login: result.user.user_id,
      })
      .eq("id", requestId);
    if (updateError) {
      throw new Error(`Staff account created but request update failed: ${updateError.message}`);
    }

    await notifyClinicAdmins({
      clinicId: row.clinic_id,
      type: "staff_slot_approved",
      title: "Staff slot approved",
      message: `${row.staff_name}'s ${row.staff_role} account has been activated.`,
      data: { requestId, userId: result.user.id, href: "/admin-dashboard/users" },
    });
    await createNotification({
      userId: result.user.id,
      clinicId: row.clinic_id,
      type: "staff_created",
      title: "Your staff account is active",
      message: "Your SmartClinic login credentials have been generated and emailed.",
      data: { href: "/portal/login" },
    });

    await sendStaffEmail({
      to: row.staff_email,
      subject: "Your SmartClinic staff account is active",
      text: [
        `Hello ${row.staff_name},`,
        ``,
        `Your ${row.staff_role} account has been approved and activated.`,
        ``,
        `User ID: ${result.credentials.user_id}`,
        `Temporary password: ${result.credentials.password}`,
        ``,
        `Login URL: ${(process.env.STAFF_PORTAL_URL || process.env.ADMIN_URL || "http://localhost:8080").replace(/\/+$/, "")}/portal/login`,
        ``,
        `Please change your password after signing in.`,
      ].join("\n"),
    });

    await writeAuditLog({
      action: "staff_slot_request_approved",
      userId: req.user?.userId,
      userRole: req.user?.role,
      resourceType: "staff_slot_request",
      resourceId: requestId,
      changes: { created_user_id: result.user.id, clinic_id: row.clinic_id, staff_role: row.staff_role },
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      newUserId: result.user.user_id,
      tempPassword: result.credentials.password,
      user: result.user,
    });
  })
);

router.post(
  "/admin/staff-requests/:requestId/reject",
  authMiddleware,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reason = cleanString((req.body as any).reason);
    if (!reason) throw new ValidationError("Rejection reason is required");

    const rzp = getRazorpay();
    if (!rzp) return sendJsonError(res, 503, "Online staff slot payment is not configured", "PAYMENTS_DISABLED");

    const supabase = getSupabaseClient();
    const { requestId } = req.params;
    const { data: request, error } = await supabase
      .from("staff_slot_requests")
      .select("*, clinics(id, name, clinic_code)")
      .eq("id", requestId)
      .maybeSingle();
    if (error || !request) return sendJsonError(res, 404, "Staff request not found", "NOT_FOUND");

    const row = request as StaffSlotRequest;
    if (row.payment_status !== "paid" || row.approval_status !== "pending_admin" || !row.razorpay_payment_id) {
      return sendJsonError(res, 400, "Only paid requests pending admin review can be rejected and refunded", "INVALID_STATUS");
    }

    const refund = await (rzp.payments as any).refund(row.razorpay_payment_id, {
      amount: row.amount,
      notes: {
        kind: "staff_slot_request_rejection",
        requestId,
        clinicId: row.clinic_id,
      },
    });

    const { error: updateError } = await supabase
      .from("staff_slot_requests")
      .update({
        approval_status: "rejected",
        rejection_reason: reason,
        refund_id: refund?.id ?? null,
      })
      .eq("id", requestId);
    if (updateError) throw new Error(`Failed to update rejected request: ${updateError.message}`);

    await notifyClinicAdmins({
      clinicId: row.clinic_id,
      type: "staff_slot_rejected",
      title: "Staff slot rejected",
      message: `Payment of ₹2,500 refunded for rejected request: ${reason}`,
      data: { requestId, refundId: refund?.id, href: "/admin-dashboard/users" },
    });

    await writeAuditLog({
      action: "staff_slot_request_rejected",
      userId: req.user?.userId,
      userRole: req.user?.role,
      resourceType: "staff_slot_request",
      resourceId: requestId,
      changes: { reason, refund_id: refund?.id ?? null, clinic_id: row.clinic_id },
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, refundId: refund?.id ?? null });
  })
);

export default router;
