import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error-handler.middleware";
import { realtimeService } from "../services/realtime.service";
import { writeAuditLog } from "../services/audit.service";
import type { CreateBillRequest, PayBillRequest, RealtimeEvent } from "@shared/api";

const router = Router();

/**
 * GET /api/billing/summary?clinicId=&date=YYYY-MM-DD
 */
router.get(
  "/summary",
  authMiddleware,
  requireRole("receptionist", "doctor", "independent", "super-admin", "clinic-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, date } = req.query as { clinicId?: string; date?: string };
    const effectiveClinicId = clinicId || req.user?.clinicId;
    if (!effectiveClinicId) {
      return res.status(400).json({ error: "clinicId is required" });
    }
    if (
      req.user?.role !== "super-admin" &&
      req.user?.clinicId !== effectiveClinicId
    ) {
      return res.status(403).json({ error: "Clinic access denied" });
    }

    const day = date || new Date().toISOString().slice(0, 10);
    const start = new Date(`${day}T00:00:00.000Z`).toISOString();
    const end = new Date(`${day}T23:59:59.999Z`).toISOString();

    const supabase =
      req.user?.role === "super-admin" || req.user?.role === "clinic-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    const { data: paidBills, error: billsErr } = await supabase
      .from("bills")
      .select("total_amount, payment_status, paid_at")
      .eq("clinic_id", effectiveClinicId)
      .eq("payment_status", "paid")
      .gte("paid_at", start)
      .lte("paid_at", end);

    if (billsErr) return res.status(500).json({ error: billsErr.message });

    const totalCollected = (paidBills || []).reduce(
      (sum, b) => sum + Number(b.total_amount || 0),
      0
    );

    const { count: completedToday, error: apptErr } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", effectiveClinicId)
      .eq("status", "completed")
      .gte("updated_at", start)
      .lte("updated_at", end);

    if (apptErr) return res.status(500).json({ error: apptErr.message });

    return res.json({
      success: true,
      summary: {
        date: day,
        totalCollected: Math.round(totalCollected * 100) / 100,
        completedToday: completedToday ?? 0,
      },
    });
  })
);

const createBillSchema = z.object({
  clinicId: z.string().uuid(),
  appointmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  consultationFee: z.number().min(0),
  medicineCost: z.number().min(0),
} satisfies Record<keyof CreateBillRequest, any>);

router.post(
  "/",
  authMiddleware,
  requireRole("receptionist", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createBillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
    }

    const total = parsed.data.consultationFee + parsed.data.medicineCost;
    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const { data, error } = await supabase
      .from("bills")
      .insert({
        clinic_id: parsed.data.clinicId,
        appointment_id: parsed.data.appointmentId,
        patient_id: parsed.data.patientId,
        created_by: req.user?.userId ?? null,
        consultation_fee: parsed.data.consultationFee,
        medicine_cost: parsed.data.medicineCost,
        total_amount: total,
      })
      .select("*")
      .single();

    if (error || !data) return res.status(500).json({ error: error?.message || "Failed to create bill" });

    await writeAuditLog({
      action: "bill_created",
      userId: req.user?.userId,
      userRole: req.user?.role,
      resourceType: "bill",
      resourceId: data.id,
      changes: {
        clinicId: parsed.data.clinicId,
        appointmentId: parsed.data.appointmentId,
        total_amount: total,
      },
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    const event: RealtimeEvent = {
      type: "bill.created",
      clinicId: parsed.data.clinicId,
      at: new Date().toISOString(),
      payload: { billId: data.id, appointmentId: parsed.data.appointmentId },
    };
    realtimeService.emit(event);

    return res.status(201).json({ success: true, bill: data });
  })
);

const payBillSchema = z.object({
  paymentMethod: z.enum(["cash", "upi", "card", "other"]),
} satisfies Record<keyof PayBillRequest, any>);

router.post(
  "/:id/payments",
  authMiddleware,
  requireRole("receptionist", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = payBillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const existing = await supabase.from("bills").select("clinic_id").eq("id", req.params.id).single();
    if (existing.error || !existing.data) return res.status(404).json({ error: "Bill not found" });
    if (req.user?.role !== "super-admin" && existing.data.clinic_id !== req.user?.clinicId) {
      return res.status(403).json({ error: "Clinic access denied" });
    }

    const { data, error } = await supabase
      .from("bills")
      .update({
        payment_status: "paid",
        payment_method: parsed.data.paymentMethod,
        paid_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error || !data) return res.status(500).json({ error: error?.message || "Failed to mark paid" });

    await writeAuditLog({
      action: "bill_paid",
      userId: req.user?.userId,
      userRole: req.user?.role,
      resourceType: "bill",
      resourceId: data.id,
      changes: {
        paymentMethod: parsed.data.paymentMethod,
        total_amount: data.total_amount,
        clinic_id: data.clinic_id,
      },
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    const event: RealtimeEvent = {
      type: "bill.paid",
      clinicId: data.clinic_id,
      at: new Date().toISOString(),
      payload: { billId: data.id },
    };
    realtimeService.emit(event);

    return res.json({ success: true, bill: data });
  })
);

export default router;
