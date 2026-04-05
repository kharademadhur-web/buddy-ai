import { Router, Request, Response } from "express";
import { z } from "zod";
import { Consultation, IMedicine } from "../models/Consultation";
import { Queue } from "../models/Queue";
import { authMiddleware } from "../middleware/auth.middleware";
import { AuditLog } from "../models/AuditLog";

const router = Router();

// Validation schemas
const startConsultationSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  clinicId: z.string().min(1, "Clinic ID is required"),
  doctorId: z.string().min(1, "Doctor ID is required"),
  problem: z.string().min(1, "Problem is required"),
});

const updateConsultationSchema = z.object({
  symptoms: z.string().optional(),
  observations: z.string().optional(),
  diagnosis: z.string().optional(),
  transcript: z.string().optional(),
  summary: z.string().optional(),
  medicines: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string(),
        frequency: z.string(),
        duration: z.string(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  advice: z.string().optional(),
  followUpDate: z.string().datetime().optional(),
  charges: z.number().optional(),
  audioUrl: z.string().optional(),
});

/**
 * POST /api/consultations/start
 * Start a new consultation
 */
router.post(
  "/start",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const validation = startConsultationSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { patientId, clinicId, doctorId, problem } = validation.data;

      // Create consultation
      const consultation = new Consultation({
        patientId,
        clinicId,
        doctorId,
        problem,
        startTime: new Date(),
        status: "in_progress",
        charges: 0,
      });

      await consultation.save();

      // Update queue status
      await Queue.findOneAndUpdate(
        { patientId, clinicId, status: "called" },
        { status: "in_consultation", consultationStartedAt: new Date() },
        { new: true }
      );

      // Log audit
      await AuditLog.create({
        userId: req.user?.userId,
        action: "start_consultation",
        resourceType: "consultation",
        resourceId: consultation._id.toString(),
        clinicId,
        description: `Started consultation with patient ${patientId}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json({
        success: true,
        consultation,
        message: "Consultation started",
      });
    } catch (error) {
      console.error("Start consultation error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to start consultation",
      });
    }
  }
);

/**
 * PUT /api/consultations/:id
 * Update consultation with notes, transcript, medicines, etc.
 */
router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const validation = updateConsultationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const {
      symptoms,
      observations,
      diagnosis,
      transcript,
      summary,
      medicines,
      advice,
      followUpDate,
      charges,
      audioUrl,
    } = validation.data;

    const consultation = await Consultation.findByIdAndUpdate(
      req.params.id,
      {
        symptoms,
        observations,
        diagnosis,
        transcript,
        summary,
        medicines: medicines || [],
        advice,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        charges: charges || 0,
        audioUrl,
      },
      { new: true, runValidators: true }
    );

    if (!consultation) {
      res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
      return;
    }

    // Log audit
    await AuditLog.create({
      userId: req.user?.userId,
      action: "edit_consultation",
      resourceType: "consultation",
      resourceId: consultation._id.toString(),
      clinicId: consultation.clinicId,
      description: "Updated consultation notes",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      consultation,
      message: "Consultation updated",
    });
  } catch (error) {
    console.error("Update consultation error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update consultation",
    });
  }
});

/**
 * POST /api/consultations/:id/end
 * End consultation and mark as completed
 */
router.post(
  "/:id/end",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const consultation = await Consultation.findByIdAndUpdate(
        req.params.id,
        {
          status: "completed",
          endTime: new Date(),
          duration: Math.round(
            (new Date().getTime() - new Date(req.body.startTime || Date.now()).getTime()) /
            60000
          ),
        },
        { new: true }
      );

      if (!consultation) {
        res.status(404).json({
          success: false,
          message: "Consultation not found",
        });
        return;
      }

      // Update queue status
      await Queue.findOneAndUpdate(
        { patientId: consultation.patientId, clinicId: consultation.clinicId, status: "in_consultation" },
        { status: "completed", completedAt: new Date() },
        { new: true }
      );

      // Log audit
      await AuditLog.create({
        userId: req.user?.userId,
        action: "end_consultation",
        resourceType: "consultation",
        resourceId: consultation._id.toString(),
        clinicId: consultation.clinicId,
        description: "Ended consultation",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        success: true,
        consultation,
        message: "Consultation completed",
      });
    } catch (error) {
      console.error("End consultation error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to end consultation",
      });
    }
  }
);

/**
 * GET /api/consultations/:id
 * Get consultation details
 */
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) {
      res.status(404).json({
        success: false,
        message: "Consultation not found",
      });
      return;
    }

    res.json({
      success: true,
      consultation,
    });
  } catch (error) {
    console.error("Get consultation error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch consultation",
    });
  }
});

/**
 * GET /api/consultations/patient/:patientId
 * Get patient's consultation history
 */
router.get(
  "/patient/:patientId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const consultations = await Consultation.find({
        patientId: req.params.patientId,
      })
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));

      const total = await Consultation.countDocuments({
        patientId: req.params.patientId,
      });

      res.json({
        success: true,
        consultations,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error("Get consultation history error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch consultations",
      });
    }
  }
);

export default router;
