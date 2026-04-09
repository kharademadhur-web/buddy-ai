import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient, getSupabaseRlsClient } from "../config/supabase";
import { signSupabaseRlsJwt } from "../config/supabase-jwt";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { realtimeService } from "../services/realtime.service";
import {
  fetchAssignedDoctorIds,
  receptionistMustCoverDoctor,
} from "../services/receptionist-scope.service";
import type {
  AppointmentDTO,
  CreateAppointmentRequest,
  RealtimeEvent,
} from "@shared/api";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

const createAppointmentSchema = z.object({
  clinicId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorUserId: z.string().uuid(),
  appointmentTime: z.string().datetime(),
  chiefComplaint: z.string().optional(),
} satisfies Record<keyof CreateAppointmentRequest, any>);

router.post(
  "/",
  authMiddleware,
  requireRole("receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");
    }

    if (req.user?.role !== "super-admin" && req.user?.clinicId !== parsed.data.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    if (req.user?.role === "receptionist") {
      const assigned = await fetchAssignedDoctorIds(req.user);
      const gate = receptionistMustCoverDoctor(req.user, parsed.data.doctorUserId, assigned);
      if (gate.ok === false) return sendJsonError(res, 403, gate.message, "FORBIDDEN");
    }

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: parsed.data.clinicId,
        patient_id: parsed.data.patientId,
        doctor_user_id: parsed.data.doctorUserId,
        receptionist_user_id: req.user?.userId ?? null,
        appointment_time: parsed.data.appointmentTime,
        chief_complaint: parsed.data.chiefComplaint ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      return sendJsonError(res, 500, error?.message || "Failed to create appointment", "INTERNAL_SERVER_ERROR");
    }

    const event: RealtimeEvent<AppointmentDTO> = {
      type: "appointment.created",
      clinicId: data.clinic_id,
      at: new Date().toISOString(),
      payload: data as AppointmentDTO,
    };
    realtimeService.emit(event);

    return res.status(201).json({ success: true, appointment: data });
  }
);

router.get("/", authMiddleware, requireRole("doctor", "receptionist", "independent", "super-admin"), async (req: Request, res: Response) => {
  const { date, doctorId, clinicId } = req.query as {
    date?: string;
    doctorId?: string;
    clinicId?: string;
  };

  const effectiveClinicId = clinicId || req.user?.clinicId;
  if (!effectiveClinicId) return sendJsonError(res, 400, "clinicId is required", "VALIDATION_ERROR");
  if (req.user?.role !== "super-admin" && req.user?.clinicId !== effectiveClinicId) {
    return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
  }

  const supabase =
    req.user?.role === "super-admin"
      ? getSupabaseClient()
      : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
  let q = supabase.from("appointments").select("*").eq("clinic_id", effectiveClinicId);

  if (req.user?.role === "receptionist") {
    const assigned = await fetchAssignedDoctorIds(req.user!);
    if (assigned.length === 0) {
      return res.json({ success: true, appointments: [] });
    }
    if (doctorId) {
      const gate = receptionistMustCoverDoctor(req.user!, doctorId, assigned);
      if (gate.ok === false) return sendJsonError(res, 403, gate.message, "FORBIDDEN");
      q = q.eq("doctor_user_id", doctorId);
    } else {
      q = q.in("doctor_user_id", assigned);
    }
  } else if (doctorId) {
    q = q.eq("doctor_user_id", doctorId);
  }

  // date is YYYY-MM-DD; filter appointment_time within day
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`).toISOString();
    const end = new Date(`${date}T23:59:59.999Z`).toISOString();
    q = q.gte("appointment_time", start).lte("appointment_time", end);
  }

  const { data, error } = await q.order("appointment_time", { ascending: true });
  if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
  return res.json({ success: true, appointments: data ?? [] });
});

const patchAppointmentSchema = z.object({
  appointmentTime: z.string().datetime().optional(),
  status: z
    .enum(["scheduled", "checked_in", "in_consultation", "completed", "cancelled", "no_show"])
    .optional(),
  chiefComplaint: z.string().optional(),
});

router.patch(
  "/:id",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = patchAppointmentSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));

    // Fetch existing to enforce clinic access
    const existing = await supabase
      .from("appointments")
      .select("clinic_id, doctor_user_id")
      .eq("id", req.params.id)
      .single();
    if (existing.error || !existing.data) return sendJsonError(res, 404, "Appointment not found", "NOT_FOUND");
    if (req.user?.role !== "super-admin" && existing.data.clinic_id !== req.user?.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }
    if (
      req.user?.role === "doctor" &&
      existing.data.doctor_user_id !== req.user?.userId
    ) {
      return sendJsonError(res, 403, "Not assigned to this appointment", "FORBIDDEN");
    }
    if (req.user?.role === "receptionist") {
      const assigned = await fetchAssignedDoctorIds(req.user);
      const gate = receptionistMustCoverDoctor(req.user, existing.data.doctor_user_id, assigned);
      if (gate.ok === false) return sendJsonError(res, 403, gate.message, "FORBIDDEN");
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.appointmentTime) update.appointment_time = parsed.data.appointmentTime;
    if (parsed.data.status) update.status = parsed.data.status;
    if (parsed.data.chiefComplaint !== undefined) update.chief_complaint = parsed.data.chiefComplaint;

    const { data, error } = await supabase
      .from("appointments")
      .update(update)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to update", "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, appointment: data });
  }
);

const checkInSchema = z.object({
  chiefComplaint: z.string().optional(),
  vitals: z.record(z.unknown()).optional(),
  intakeHistory: z.record(z.unknown()).optional(),
});

router.post(
  "/:id/checkin",
  authMiddleware,
  requireRole("receptionist", "super-admin"),
  async (req: Request, res: Response) => {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const supabase =
      req.user?.role === "super-admin"
        ? getSupabaseClient()
        : getSupabaseRlsClient(signSupabaseRlsJwt(req.user!));
    const existing = await supabase
      .from("appointments")
      .select("clinic_id, doctor_user_id")
      .eq("id", req.params.id)
      .single();
    if (existing.error || !existing.data) return sendJsonError(res, 404, "Appointment not found", "NOT_FOUND");
    if (req.user?.role !== "super-admin" && existing.data.clinic_id !== req.user?.clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }
    if (req.user?.role === "receptionist") {
      const assigned = await fetchAssignedDoctorIds(req.user!);
      const gate = receptionistMustCoverDoctor(req.user!, existing.data.doctor_user_id, assigned);
      if (gate.ok === false) return sendJsonError(res, 403, gate.message, "FORBIDDEN");
    }

    const { data, error } = await supabase
      .from("appointments")
      .update({
        status: "checked_in",
        checked_in_by: req.user?.userId ?? null,
        checked_in_time: new Date().toISOString(),
        chief_complaint: parsed.data.chiefComplaint ?? null,
        vitals: parsed.data.vitals ?? null,
        intake_history: parsed.data.intakeHistory ?? null,
      })
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error || !data) return sendJsonError(res, 500, error?.message || "Failed to check in", "INTERNAL_SERVER_ERROR");

    const event: RealtimeEvent<AppointmentDTO> = {
      type: "appointment.checked_in",
      clinicId: data.clinic_id,
      at: new Date().toISOString(),
      payload: data as AppointmentDTO,
    };
    realtimeService.emit(event);

    return res.json({ success: true, appointment: data });
  }
);

export default router;

