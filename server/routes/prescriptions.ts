import { Router, Request, Response } from "express";
import { z } from "zod";
import { Prescription } from "../models/Prescription";
import { Consultation } from "../models/Consultation";
import { authMiddleware } from "../middleware/auth.middleware";
import { AuditLog } from "../models/AuditLog";

const router = Router();

// Validation schemas
const createPrescriptionSchema = z.object({
  consultationId: z.string().min(1, "Consultation ID is required"),
  patientId: z.string().min(1, "Patient ID is required"),
  doctorId: z.string().min(1, "Doctor ID is required"),
  clinicId: z.string().min(1, "Clinic ID is required"),
  summary: z.string().min(1, "Summary is required"),
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
    .default([]),
  advice: z.string().optional(),
  followUpDate: z.string().datetime().optional(),
  diagnosis: z.string().optional(),
  investigations: z.string().optional(),
});

/**
 * POST /api/prescriptions
 * Create a new prescription
 */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const validation = createPrescriptionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const {
      consultationId,
      patientId,
      doctorId,
      clinicId,
      summary,
      medicines,
      advice,
      followUpDate,
      diagnosis,
      investigations,
    } = validation.data;

    // Create prescription
    const prescription = new Prescription({
      consultationId,
      patientId,
      doctorId,
      clinicId,
      summary,
      medicines: medicines || [],
      advice,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      diagnosis,
      investigations,
      status: "draft",
    });

    await prescription.save();

    // Log audit
    await AuditLog.create({
      userId: req.user?.userId,
      action: "create_prescription",
      resourceType: "prescription",
      resourceId: prescription._id.toString(),
      clinicId,
      description: "Created prescription",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json({
      success: true,
      prescription,
      message: "Prescription created",
    });
  } catch (error) {
    console.error("Create prescription error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create prescription",
    });
  }
});

/**
 * POST /api/prescriptions/:id/generate-pdf
 * Generate PDF from prescription (placeholder for Puppeteer integration)
 * TODO: Implement Puppeteer PDF generation and S3 upload
 */
router.post(
  "/:id/generate-pdf",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const prescription = await Prescription.findById(req.params.id);
      if (!prescription) {
        res.status(404).json({
          success: false,
          message: "Prescription not found",
        });
        return;
      }

      // TODO: Implement actual PDF generation
      // 1. Use Puppeteer to render HTML template
      // 2. Upload PDF to AWS S3
      // 3. Save S3 URL to prescription.pdfUrl
      // 4. Update prescription status to "finalized"

      // Placeholder: Generate fake S3 URL
      const pdfUrl = `s3://clinic-saas-prod/prescriptions/${req.params.id}.pdf`;
      prescription.pdfUrl = pdfUrl;
      prescription.status = "finalized";
      await prescription.save();

      // Log audit
      await AuditLog.create({
        userId: req.user?.userId,
        action: "generate_pdf",
        resourceType: "prescription",
        resourceId: prescription._id.toString(),
        clinicId: prescription.clinicId,
        description: "Generated prescription PDF",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        success: true,
        prescription,
        pdfUrl,
        message: "PDF generated successfully",
      });
    } catch (error) {
      console.error("Generate PDF error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to generate PDF",
      });
    }
  }
);

/**
 * GET /api/prescriptions/:id
 * Get prescription details
 */
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const prescription = await Prescription.findById(req.params.id);
    if (!prescription) {
      res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
      return;
    }

    res.json({
      success: true,
      prescription,
    });
  } catch (error) {
    console.error("Get prescription error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch prescription",
    });
  }
});

/**
 * GET /api/prescriptions/patient/:patientId
 * Get patient's prescription history
 */
router.get(
  "/patient/:patientId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const prescriptions = await Prescription.find({
        patientId: req.params.patientId,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));

      const total = await Prescription.countDocuments({
        patientId: req.params.patientId,
      });

      res.json({
        success: true,
        prescriptions,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error("Get prescription history error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch prescriptions",
      });
    }
  }
);

/**
 * PUT /api/prescriptions/:id
 * Update prescription
 */
router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const prescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!prescription) {
      res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
      return;
    }

    // Log audit
    await AuditLog.create({
      userId: req.user?.userId,
      action: "edit_prescription",
      resourceType: "prescription",
      resourceId: prescription._id.toString(),
      clinicId: prescription.clinicId,
      description: "Updated prescription",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      changes: updates,
    });

    res.json({
      success: true,
      prescription,
      message: "Prescription updated",
    });
  } catch (error) {
    console.error("Update prescription error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update prescription",
    });
  }
});

export default router;
