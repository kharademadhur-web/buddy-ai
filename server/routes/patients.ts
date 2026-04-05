import { Router, Request, Response } from "express";
import { z } from "zod";
import { Patient } from "../models/Patient";
import { authMiddleware } from "../middleware/auth.middleware";
import { AuditLog } from "../models/AuditLog";

const router = Router();

// Validation schemas
const createPatientSchema = z.object({
  clinicId: z.string().min(1, "Clinic ID is required"),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  problem: z.string().min(1, "Problem/reason for visit is required"),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  emergencyContact: z.string().optional(),
});

/**
 * POST /api/patients/register
 * Reception staff registers a new patient
 */
router.post(
  "/register",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const validation = createPatientSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const {
        clinicId,
        name,
        phone,
        email,
        dateOfBirth,
        gender,
        problem,
        medicalHistory,
        allergies,
        emergencyContact,
      } = validation.data;

      // Check if patient already exists
      const existingPatient = await Patient.findOne({ clinicId, phone });
      if (existingPatient) {
        // Update last visit
        existingPatient.lastVisit = new Date();
        await existingPatient.save();
        
        res.json({
          success: true,
          patient: existingPatient,
          isNewPatient: false,
          message: "Patient already registered",
        });
        return;
      }

      // Create new patient
      const patient = new Patient({
        clinicId,
        name,
        phone,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        problem,
        medicalHistory,
        allergies,
        emergencyContact,
        registeredAt: new Date(),
      });

      await patient.save();

      // Log audit
      await AuditLog.create({
        userId: req.user?.userId,
        action: "create_patient",
        resourceType: "patient",
        resourceId: patient._id.toString(),
        clinicId,
        description: `Created patient: ${name}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json({
        success: true,
        patient,
        isNewPatient: true,
        message: "Patient registered successfully",
      });
    } catch (error) {
      console.error("Patient registration error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to register patient",
      });
    }
  }
);

/**
 * GET /api/patients/:id
 * Get patient details
 */
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      res.status(404).json({
        success: false,
        message: "Patient not found",
      });
      return;
    }

    res.json({
      success: true,
      patient,
    });
  } catch (error) {
    console.error("Get patient error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch patient",
    });
  }
});

/**
 * GET /api/patients/clinic/:clinicId
 * Get all patients for a clinic
 */
router.get(
  "/clinic/:clinicId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const patients = await Patient.find({ clinicId: req.params.clinicId })
        .sort({ registeredAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));

      const total = await Patient.countDocuments({
        clinicId: req.params.clinicId,
      });

      res.json({
        success: true,
        patients,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error("Get clinic patients error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch patients",
      });
    }
  }
);

/**
 * PUT /api/patients/:id
 * Update patient details
 */
router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const patient = await Patient.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!patient) {
      res.status(404).json({
        success: false,
        message: "Patient not found",
      });
      return;
    }

    // Log audit
    await AuditLog.create({
      userId: req.user?.userId,
      action: "edit_patient",
      resourceType: "patient",
      resourceId: patient._id.toString(),
      clinicId: patient.clinicId,
      description: `Updated patient: ${patient.name}`,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      changes: updates,
    });

    res.json({
      success: true,
      patient,
      message: "Patient updated successfully",
    });
  } catch (error) {
    console.error("Update patient error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update patient",
    });
  }
});

export default router;
