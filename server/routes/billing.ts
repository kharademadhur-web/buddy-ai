import { Router, Request, Response } from "express";
import { z } from "zod";
import { Billing } from "../models/Billing";
import { authMiddleware } from "../middleware/auth.middleware";
import { AuditLog } from "../models/AuditLog";

const router = Router();

// Validation schemas
const createBillingSchema = z.object({
  consultationId: z.string().min(1, "Consultation ID is required"),
  patientId: z.string().min(1, "Patient ID is required"),
  clinicId: z.string().min(1, "Clinic ID is required"),
  consultationFee: z.number().positive("Consultation fee must be positive"),
  extraCharges: z.number().nonnegative().optional(),
});

const markPaidSchema = z.object({
  method: z.enum(["cash", "card", "upi", "qr", "check"]),
});

/**
 * POST /api/billing
 * Create billing record for a consultation
 */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const validation = createBillingSchema.safeParse(req.body);
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
      clinicId,
      consultationFee,
      extraCharges = 0,
    } = validation.data;

    // Calculate total
    const totalAmount = consultationFee + extraCharges;

    // Create billing record
    const billing = new Billing({
      consultationId,
      patientId,
      clinicId,
      consultationFee,
      extraCharges,
      totalAmount,
      status: "pending",
    });

    await billing.save();

    // Log audit
    await AuditLog.create({
      userId: req.user?.userId,
      action: "create_billing",
      resourceType: "billing",
      resourceId: billing._id.toString(),
      clinicId,
      description: `Created billing: ₹${totalAmount}`,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json({
      success: true,
      billing,
      message: "Billing created",
    });
  } catch (error) {
    console.error("Create billing error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create billing",
    });
  }
});

/**
 * POST /api/billing/:id/mark-paid
 * Mark billing as paid and trigger follow-up actions (WhatsApp, etc.)
 */
router.post(
  "/:id/mark-paid",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const validation = markPaidSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { method } = validation.data;

      const billing = await Billing.findByIdAndUpdate(
        req.params.id,
        {
          status: "paid",
          method,
          paidAt: new Date(),
        },
        { new: true }
      );

      if (!billing) {
        res.status(404).json({
          success: false,
          message: "Billing not found",
        });
        return;
      }

      // TODO: Trigger follow-up actions:
      // 1. Generate receipt PDF (upload to S3)
      // 2. Send receipt via WhatsApp
      // 3. Create FollowUp reminder (2, 5, 7 days)

      // Log audit
      await AuditLog.create({
        userId: req.user?.userId,
        action: "mark_payment",
        resourceType: "billing",
        resourceId: billing._id.toString(),
        clinicId: billing.clinicId,
        description: `Marked payment via ${method}: ₹${billing.totalAmount}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        success: true,
        billing,
        message: "Payment marked successfully",
      });
    } catch (error) {
      console.error("Mark payment error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to mark payment",
      });
    }
  }
);

/**
 * GET /api/billing/:id
 * Get billing details
 */
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      res.status(404).json({
        success: false,
        message: "Billing not found",
      });
      return;
    }

    res.json({
      success: true,
      billing,
    });
  } catch (error) {
    console.error("Get billing error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch billing",
    });
  }
});

/**
 * GET /api/billing/clinic/:clinicId
 * Get clinic billing (daily revenue, etc.)
 */
router.get(
  "/clinic/:clinicId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const filter: Record<string, any> = { clinicId: req.params.clinicId };
      if (status) {
        filter.status = status;
      }

      const billings = await Billing.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));

      const total = await Billing.countDocuments(filter);

      // Calculate revenue
      const paidBillings = await Billing.find({
        clinicId: req.params.clinicId,
        status: "paid",
      });
      const totalRevenue = paidBillings.reduce(
        (sum, b) => sum + b.totalAmount,
        0
      );

      res.json({
        success: true,
        billings,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string)),
        },
        revenue: {
          total: totalRevenue,
          count: paidBillings.length,
        },
      });
    } catch (error) {
      console.error("Get clinic billing error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch billing",
      });
    }
  }
);

export default router;
