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
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

function isMissingBillsCreatedByColumnError(message: string): boolean {
  return /Could not find the 'created_by' column of 'bills'|column .*created_by.* does not exist/i.test(
    message
  );
}

function isMissingConsultationWorkflowColumnsError(message: string): boolean {
  return /Could not find the '(workflow_status|payment_notified_at)' column of 'consultations'|column .*workflow_status.* does not exist|column .*payment_notified_at.* does not exist/i.test(
    message
  );
}

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
      return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    }
    if (
      req.user?.role !== "super-admin" &&
      req.user?.clinicId !== effectiveClinicId
    ) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
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

    if (billsErr) return sendJsonError(res, 500, billsErr.message, "INTERNAL_SERVER_ERROR");

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

    if (apptErr) return sendJsonError(res, 500, apptErr.message, "INTERNAL_SERVER_ERROR");

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

/**
 * GET /api/billing?clinicId=&paymentStatus=pending&limit=30
 * List bills for checkout / printing (receptionist RLS applies).
 */
router.get(
  "/",
  authMiddleware,
  requireRole("receptionist", "super-admin", "clinic-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, paymentStatus, limit } = req.query as {
      clinicId?: string;
      paymentStatus?: string;
      limit?: string;
    };
    const effectiveClinicId = clinicId || req.user?.clinicId;
    if (!effectiveClinicId) {
      return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
    }
    if (req.user?.role === "clinic-admin") {
      if (!req.user.clinicId || req.user.clinicId !== effectiveClinicId) {
        return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
      }
    } else if (req.user?.role !== "super-admin" && req.user?.clinicId !== effectiveClinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const take = Math.min(Math.max(parseInt(limit || "30", 10) || 30, 1), 100);
    const supabase =
      req.user?.role === "super-admin" || req.user?.role === "clinic-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    let q = supabase
      .from("bills")
      .select(
        "id, clinic_id, appointment_id, patient_id, consultation_fee, medicine_cost, total_amount, payment_status, payment_method, paid_at, created_at, patients(name, phone)"
      )
      .eq("clinic_id", effectiveClinicId)
      .order("created_at", { ascending: false })
      .limit(take);

    if (paymentStatus) {
      q = q.eq("payment_status", paymentStatus);
    }

    const { data, error } = await q;
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");

    return res.json({ success: true, bills: data ?? [] });
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
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    const total = parsed.data.consultationFee + parsed.data.medicineCost;
    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const billInsert: Record<string, unknown> = {
      clinic_id: parsed.data.clinicId,
      appointment_id: parsed.data.appointmentId,
      patient_id: parsed.data.patientId,
      created_by: req.user?.userId ?? null,
      consultation_fee: parsed.data.consultationFee,
      medicine_cost: parsed.data.medicineCost,
      total_amount: total,
    };

    let { data, error } = await supabase
      .from("bills")
      .insert(billInsert)
      .select("*")
      .single();

    if (error && isMissingBillsCreatedByColumnError(error.message)) {
      console.warn("[billing] bills.created_by missing; retrying insert without created_by");
      delete billInsert.created_by;
      const retry = await supabase
        .from("bills")
        .insert(billInsert)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to create bill", "INTERNAL_SERVER_ERROR");

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
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const existing = await supabase
      .from("bills")
      .select("clinic_id, appointment_id")
      .eq("id", req.params.id)
      .single();
    if (existing.error || !existing.data) return sendJsonError(res, 404, "Bill not found", "NOT_FOUND");
    if (req.user?.role !== "super-admin" && existing.data.clinic_id !== req.user?.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
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

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to mark paid", "INTERNAL_SERVER_ERROR");

    let doctorUserId: string | null = null;
    if (existing.data.appointment_id) {
      const apptRow = await supabase
        .from("appointments")
        .select("doctor_user_id")
        .eq("id", existing.data.appointment_id)
        .maybeSingle();
      doctorUserId = apptRow.data?.doctor_user_id ?? null;

      const paidAt = data.paid_at || new Date().toISOString();
      // Receptionists may not UPDATE consultations under RLS; service role keeps workflow in sync.
      const workflowSync = await getSupabaseClient()
        .from("consultations")
        .update({
          workflow_status: "paid",
          payment_notified_at: paidAt,
        })
        .eq("appointment_id", existing.data.appointment_id);
      if (workflowSync.error && !isMissingConsultationWorkflowColumnsError(workflowSync.error.message)) {
        console.warn("[billing] failed syncing consultation workflow:", workflowSync.error.message);
      }
    }

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
      payload: {
        billId: data.id,
        appointmentId: existing.data.appointment_id,
        doctorUserId,
      },
    };
    realtimeService.emit(event);

    realtimeService.emit({
      type: "payment.success",
      clinicId: data.clinic_id,
      at: new Date().toISOString(),
      payload: {
        billId: data.id,
        appointmentId: existing.data.appointment_id,
        doctorUserId,
      },
    });

    return res.json({ success: true, bill: data });
  })
);

export default router;
