import { Router, Request, Response } from "express";
import { z } from "zod";
import { FollowUp } from "../models/FollowUp";
import { Clinic } from "../models/Clinic";
import { Doctor } from "../models/Doctor";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

const router = Router();

// Validation schemas
const scheduleFollowUpSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  doctorId: z.string().min(1, "Doctor ID is required"),
  clinicId: z.string().min(1, "Clinic ID is required"),
  scheduledDate: z.string().refine((val) => {
    const date = new Date(val);
    return date > new Date();
  }, "Scheduled date must be in the future"),
  notes: z.string().optional().default(""),
  notificationChannel: z
    .enum(["whatsapp", "sms", "email"])
    .optional()
    .default("whatsapp"),
  reminderMinutesBefore: z.number().optional().default(60),
});

const updateFollowUpSchema = scheduleFollowUpSchema.partial().omit({
  patientId: true,
  doctorId: true,
  clinicId: true,
});

/**
 * POST /api/followups/schedule
 * Schedule a follow-up appointment (requires doctor or clinic admin)
 */
router.post(
  "/schedule",
  authMiddleware,
  requireRole("doctor", "clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validation = scheduleFollowUpSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const {
        patientId,
        doctorId,
        clinicId,
        scheduledDate,
        notes,
        notificationChannel,
        reminderMinutesBefore,
      } = validation.data;

      // Verify clinic exists
      const clinic = await Clinic.findById(clinicId);
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: "Clinic not found",
        });
        return;
      }

      // Check access: must be clinic admin or doctor in clinic
      let hasAccess = false;
      if (req.user.role === "super-admin") {
        hasAccess = true;
      } else if (clinic.adminId.toString() === req.user.id) {
        hasAccess = true;
      } else if (req.user.role === "doctor") {
        const doctor = await Doctor.findOne({ userId: req.user.id });
        if (doctor && doctor.clinicId?.toString() === clinicId) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
        return;
      }

      // Verify doctor belongs to clinic
      if (doctorId) {
        const doctor = await Doctor.findById(doctorId);
        if (!doctor || doctor.clinicId?.toString() !== clinicId) {
          res.status(400).json({
            success: false,
            message: "Doctor does not belong to this clinic",
          });
          return;
        }
      }

      // Create follow-up
      const followUp = new FollowUp({
        patientId,
        doctorId,
        clinicId,
        scheduledDate: new Date(scheduledDate),
        notes,
        notificationChannel,
        reminderMinutesBefore,
        status: "scheduled",
      });

      await followUp.save();

      // TODO: Queue notification/reminder task
      // This would integrate with the WhatsApp/SMS/Email service

      res.status(201).json({
        success: true,
        message: "Follow-up scheduled successfully",
        followUp: {
          id: followUp._id,
          patientId: followUp.patientId,
          doctorId: followUp.doctorId,
          scheduledDate: followUp.scheduledDate,
          status: followUp.status,
          notificationChannel: followUp.notificationChannel,
        },
      });
    } catch (error) {
      console.error("Schedule follow-up error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to schedule follow-up",
      });
    }
  }
);

/**
 * GET /api/followups/upcoming
 * Get upcoming follow-ups (requires doctor or clinic admin)
 */
router.get(
  "/upcoming",
  authMiddleware,
  requireRole("doctor", "clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const clinicId = req.query.clinicId as string;
      const doctorId = req.query.doctorId as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      let query: Record<string, any> = {
        status: { $in: ["scheduled", "reminded"] },
        scheduledDate: { $gt: new Date() },
      };

      // Apply filters based on user role
      if (req.user.role === "doctor") {
        const doctor = await Doctor.findOne({ userId: req.user.id });
        if (doctor) {
          query.doctorId = doctor._id;
          query.clinicId = doctor.clinicId;
        } else {
          res.status(404).json({
            success: false,
            message: "Doctor profile not found",
          });
          return;
        }
      } else if (req.user.role === "clinic") {
        const clinic = await Clinic.findOne({ adminId: req.user.id });
        if (clinic) {
          query.clinicId = clinic._id;
          if (doctorId) {
            query.doctorId = doctorId;
          }
        } else {
          res.status(404).json({
            success: false,
            message: "Clinic not found",
          });
          return;
        }
      } else if (req.user.role === "super-admin" && clinicId) {
        query.clinicId = clinicId;
        if (doctorId) {
          query.doctorId = doctorId;
        }
      }

      // Fetch follow-ups
      const followUps = await FollowUp.find(query)
        .sort({ scheduledDate: 1 })
        .limit(limit)
        .skip(offset);

      const total = await FollowUp.countDocuments(query);

      res.json({
        success: true,
        followUps: followUps.map((fu) => ({
          id: fu._id,
          patientId: fu.patientId,
          doctorId: fu.doctorId,
          scheduledDate: fu.scheduledDate,
          notes: fu.notes,
          status: fu.status,
          notificationChannel: fu.notificationChannel,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error("Get upcoming follow-ups error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch upcoming follow-ups",
      });
    }
  }
);

/**
 * GET /api/followups/:id
 * Get follow-up details (requires doctor or clinic admin)
 */
router.get(
  "/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const followUp = await FollowUp.findById(req.params.id);

      if (!followUp) {
        res.status(404).json({
          success: false,
          message: "Follow-up not found",
        });
        return;
      }

      // Check access
      let hasAccess = false;
      if (req.user.role === "super-admin") {
        hasAccess = true;
      } else {
        const clinic = await Clinic.findById(followUp.clinicId);
        if (clinic && clinic.adminId.toString() === req.user.id) {
          hasAccess = true;
        } else if (req.user.role === "doctor") {
          const doctor = await Doctor.findOne({ userId: req.user.id });
          if (doctor && doctor._id?.toString() === followUp.doctorId.toString()) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
        return;
      }

      res.json({
        success: true,
        followUp: {
          id: followUp._id,
          patientId: followUp.patientId,
          doctorId: followUp.doctorId,
          clinicId: followUp.clinicId,
          scheduledDate: followUp.scheduledDate,
          notes: followUp.notes,
          status: followUp.status,
          notificationChannel: followUp.notificationChannel,
          reminderSentAt: followUp.reminderSentAt,
          completedAt: followUp.completedAt,
        },
      });
    } catch (error) {
      console.error("Get follow-up error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch follow-up",
      });
    }
  }
);

/**
 * PUT /api/followups/:id
 * Update follow-up (requires doctor or clinic admin)
 */
router.put(
  "/:id",
  authMiddleware,
  requireRole("doctor", "clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = updateFollowUpSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const followUp = await FollowUp.findById(req.params.id);

      if (!followUp) {
        res.status(404).json({
          success: false,
          message: "Follow-up not found",
        });
        return;
      }

      // Check access
      let hasAccess = false;
      if (req.user.role === "super-admin") {
        hasAccess = true;
      } else {
        const clinic = await Clinic.findById(followUp.clinicId);
        if (clinic && clinic.adminId.toString() === req.user.id) {
          hasAccess = true;
        } else if (req.user.role === "doctor") {
          const doctor = await Doctor.findOne({ userId: req.user.id });
          if (doctor && doctor._id?.toString() === followUp.doctorId.toString()) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
        return;
      }

      // Update follow-up
      Object.assign(followUp, validation.data);
      await followUp.save();

      res.json({
        success: true,
        message: "Follow-up updated successfully",
        followUp: {
          id: followUp._id,
          scheduledDate: followUp.scheduledDate,
          status: followUp.status,
        },
      });
    } catch (error) {
      console.error("Update follow-up error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update follow-up",
      });
    }
  }
);

/**
 * PUT /api/followups/:id/complete
 * Mark follow-up as completed (requires doctor or clinic admin)
 */
router.put(
  "/:id/complete",
  authMiddleware,
  requireRole("doctor", "clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const followUp = await FollowUp.findById(req.params.id);

      if (!followUp) {
        res.status(404).json({
          success: false,
          message: "Follow-up not found",
        });
        return;
      }

      // Check access
      let hasAccess = false;
      if (req.user.role === "super-admin") {
        hasAccess = true;
      } else {
        const clinic = await Clinic.findById(followUp.clinicId);
        if (clinic && clinic.adminId.toString() === req.user.id) {
          hasAccess = true;
        } else if (req.user.role === "doctor") {
          const doctor = await Doctor.findOne({ userId: req.user.id });
          if (doctor && doctor._id?.toString() === followUp.doctorId.toString()) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
        return;
      }

      followUp.status = "completed";
      followUp.completedAt = new Date();
      await followUp.save();

      res.json({
        success: true,
        message: "Follow-up marked as completed",
      });
    } catch (error) {
      console.error("Complete follow-up error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark follow-up as completed",
      });
    }
  }
);

export default router;
