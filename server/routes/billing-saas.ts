import { Router, Request, Response } from "express";
import Razorpay from "razorpay";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";
import { asyncHandler, ForbiddenError, ValidationError } from "../middleware/error-handler.middleware";
import { getSupabaseClient } from "../config/supabase";
import { sendJsonError } from "../lib/send-json-error";
import { recordSaasPaymentAndExtendSubscription } from "../services/clinic-saas-subscription.service";

const router = Router();

/**
 * GET /api/admin/billing-saas/status
 * Whether Razorpay keys are configured (for UI).
 */
router.get(
  "/status",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const configured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    res.json({ success: true, configured });
  })
);

function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function effectiveClinicId(req: Request, bodyClinicId?: string): string {
  if (req.user?.role === "clinic-admin") {
    if (!req.user.clinicId) throw new ForbiddenError("No clinic assigned");
    return req.user.clinicId;
  }
  if (req.user?.role === "super-admin") {
    const id = bodyClinicId || (req.query.clinicId as string);
    if (!id) throw new ValidationError("clinicId is required");
    return id;
  }
  throw new ForbiddenError("Access denied");
}

/**
 * POST /api/admin/billing-saas/create-order
 * Body: { months?: number, clinicId?: string } — clinicId only for super-admin test flows.
 * Returns Razorpay order + key id for Checkout.
 */
router.post(
  "/create-order",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const rzp = getRazorpay();
    if (!rzp) {
      return sendJsonError(res, 503, "Online subscription payment is not configured", "PAYMENTS_DISABLED");
    }

    const months = Math.max(1, Math.min(36, parseInt(String((req.body as { months?: number }).months ?? 1), 10) || 1));
    const clinicId = effectiveClinicId(req, (req.body as { clinicId?: string }).clinicId);

    const supabase = getSupabaseClient();
    const { data: clinic, error: cErr } = await supabase
      .from("clinics")
      .select("id, name, saas_plan_amount_monthly")
      .eq("id", clinicId)
      .maybeSingle();

    if (cErr || !clinic) {
      return sendJsonError(res, 404, "Clinic not found", "NOT_FOUND");
    }

    const monthly = Number((clinic as { saas_plan_amount_monthly?: number }).saas_plan_amount_monthly ?? 5999);
    const amountRupees = monthly * months;
    const amountPaise = Math.round(amountRupees * 100);

    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `saas_${clinicId.slice(0, 8)}_${Date.now()}`,
      notes: {
        clinicId,
        months: String(months),
        kind: "clinic_saas_subscription",
      },
    });

    res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency || "INR",
      months,
      clinicName: (clinic as { name?: string }).name ?? "Clinic",
    });
  })
);

/**
 * POST /api/admin/billing-saas/verify-payment
 * After Checkout success — optional fast path if webhook is delayed.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
router.post(
  "/verify-payment",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const rzp = getRazorpay();
    if (!rzp) {
      return sendJsonError(res, 503, "Online subscription payment is not configured", "PAYMENTS_DISABLED");
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return sendJsonError(res, 400, "Missing payment fields", "VALIDATION_ERROR");
    }

    const crypto = await import("crypto");
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return sendJsonError(res, 400, "Invalid payment signature", "INVALID_SIGNATURE");
    }

    const order = await rzp.orders.fetch(razorpay_order_id);
    const notes = (order as { notes?: Record<string, string> }).notes || {};
    const clinicId = notes.clinicId;
    const months = parseInt(notes.months || "1", 10) || 1;

    if (!clinicId || notes.kind !== "clinic_saas_subscription") {
      return sendJsonError(res, 400, "Invalid order metadata", "INVALID_ORDER");
    }

    if (req.user?.role === "clinic-admin" && req.user.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic mismatch", "FORBIDDEN");
    }

    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from("clinic_saas_payments")
      .select("id")
      .ilike("notes", `%${razorpay_payment_id}%`)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, alreadyProcessed: true, message: "Payment already recorded" });
    }

    const payment = await rzp.payments.fetch(razorpay_payment_id);
    const paidAt =
      (payment as { created_at?: number }).created_at != null
        ? new Date((payment as { created_at: number }).created_at * 1000).toISOString()
        : new Date().toISOString();

    const amountRupees = Number((payment as { amount?: number }).amount ?? 0) / 100;

    const result = await recordSaasPaymentAndExtendSubscription(supabase, {
      clinicId,
      amount: amountRupees,
      months,
      notes: `Razorpay ${razorpay_payment_id}`,
      createdByUserId: req.user?.userId ?? null,
      paidAt,
    });

    res.json({
      success: true,
      clinic: result.clinic,
      period: result.period,
    });
  })
);

export default router;
