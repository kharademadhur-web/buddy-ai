import type { Request, Response } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { getSupabaseClient } from "../config/supabase";
import { recordSaasPaymentAndExtendSubscription } from "../services/clinic-saas-subscription.service";

/**
 * Raw-body Razorpay webhook. Mounted before express.json() in server bootstrap.
 * Handles payment.captured for SaaS subscription orders.
 */
export default async function billingSaasWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    res.status(503).json({ ok: false });
    return;
  }

  const buf = req.body as Buffer | undefined;
  const raw = buf ? buf.toString("utf8") : "";
  const signature = req.get("x-razorpay-signature") || "";

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (signature !== expected) {
    res.status(400).json({ ok: false, error: "bad_signature" });
    return;
  }

  let payload: { event?: string; payload?: { payment?: { entity?: Record<string, unknown> } } };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    res.status(400).json({ ok: false });
    return;
  }

  if (payload.event !== "payment.captured") {
    res.json({ ok: true, ignored: true });
    return;
  }

  const entity = payload.payload?.payment?.entity;
  const orderId = entity?.order_id as string | undefined;
  const paymentId = entity?.id as string | undefined;
  if (!orderId || !paymentId) {
    res.json({ ok: true, ignored: true });
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    res.status(503).json({ ok: false });
    return;
  }

  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

  let order: { notes?: Record<string, string> };
  try {
    order = (await rzp.orders.fetch(orderId)) as { notes?: Record<string, string> };
  } catch {
    res.status(500).json({ ok: false });
    return;
  }

  const notes = order.notes || {};
  if (notes.kind !== "clinic_saas_subscription" || !notes.clinicId) {
    res.json({ ok: true, ignored: true });
    return;
  }

  const clinicId = notes.clinicId;
  const months = Math.max(1, parseInt(notes.months || "1", 10) || 1);

  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from("clinic_saas_payments")
    .select("id")
    .ilike("notes", `%${paymentId}%`)
    .maybeSingle();

  if (existing) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  const payment = await rzp.payments.fetch(paymentId);
  const paidAt =
    (payment as { created_at?: number }).created_at != null
      ? new Date((payment as { created_at: number }).created_at * 1000).toISOString()
      : new Date().toISOString();

  const amountRupees = Number((payment as { amount?: number }).amount ?? 0) / 100;

  try {
    await recordSaasPaymentAndExtendSubscription(supabase, {
      clinicId,
      amount: amountRupees,
      months,
      notes: `Razorpay webhook ${paymentId}`,
      createdByUserId: null,
      paidAt,
    });
  } catch (e) {
    console.error("[billing-saas-webhook]", e);
    res.status(500).json({ ok: false });
    return;
  }

  res.json({ ok: true });
}
