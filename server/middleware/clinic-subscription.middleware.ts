import type { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../config/supabase";
import {
  getClinicLoginDenialMessage,
  requiresClinicSubscriptionCheck,
  syncClinicPaymentDueIfExpired,
} from "../lib/clinic-subscription-access";
import { sendJsonError } from "../lib/send-json-error";

/**
 * Request-time SaaS gate for clinic-scoped roles.
 * This prevents access with still-valid JWTs after subscription expiry/suspension.
 */
export async function requireActiveClinicSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const role = req.user?.role;
    if (!requiresClinicSubscriptionCheck(role)) {
      next();
      return;
    }

    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      sendJsonError(res, 403, "Clinic is not assigned to this account", "CLINIC_ACCESS_DENIED");
      return;
    }

    const supabase = getSupabaseClient();
    await syncClinicPaymentDueIfExpired(supabase, clinicId);
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, subscription_status, subscription_expires_at")
      .eq("id", clinicId)
      .maybeSingle();

    const denial = getClinicLoginDenialMessage((clinic as any) || null);
    if (denial) {
      sendJsonError(res, 402, denial, "SUBSCRIPTION_REQUIRED");
      return;
    }

    next();
  } catch {
    sendJsonError(res, 500, "Failed to validate clinic subscription", "SUBSCRIPTION_CHECK_FAILED");
  }
}

