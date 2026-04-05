import { Router, Request, Response } from "express";
import { z } from "zod";
import { Subscription } from "../models/Subscription";
import { Clinic } from "../models/Clinic";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

const router = Router();

// Validation schemas
const selectPlanSchema = z.object({
  clinicId: z.string().min(1, "Clinic ID is required"),
  planType: z.enum(["monthly", "yearly"], {
    errorMap: () => ({ message: "Invalid plan type" }),
  }),
  autoPayEnabled: z.boolean().optional().default(true),
});

// Available subscription plans
const SUBSCRIPTION_PLANS = [
  {
    id: "monthly",
    name: "Monthly Plan",
    type: "monthly",
    price: 999,
    currency: "INR",
    duration: 30,
    features: [
      "Up to 100 patients",
      "Basic scheduling",
      "Patient records",
      "Mobile app access",
      "Email support",
    ],
  },
  {
    id: "yearly",
    name: "Yearly Plan",
    type: "yearly",
    price: 9999,
    currency: "INR",
    duration: 365,
    features: [
      "Unlimited patients",
      "Advanced scheduling",
      "Complete patient records",
      "Mobile app with offline mode",
      "Analytics dashboard",
      "Priority support",
      "Custom branding",
      "API access",
    ],
  },
];

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans (public endpoint)
 */
router.get("/plans", async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      plans: SUBSCRIPTION_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        type: plan.type,
        price: plan.price,
        currency: plan.currency,
        duration: plan.duration,
        features: plan.features,
      })),
    });
  } catch (error) {
    console.error("Get plans error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
    });
  }
});

/**
 * GET /api/subscriptions/current
 * Get current subscription (requires authentication)
 */
router.get(
  "/current",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const clinicId = req.query.clinicId as string;

      if (!clinicId) {
        // Get user's clinic first
        const clinic = await Clinic.findOne({ adminId: req.user.id });
        if (!clinic) {
          res.status(404).json({
            success: false,
            message: "Clinic not found",
          });
          return;
        }

        const subscription = await Subscription.findOne({
          clinicId: clinic._id,
        });

        if (!subscription) {
          res.status(404).json({
            success: false,
            message: "No active subscription",
          });
          return;
        }

        res.json({
          success: true,
          subscription: {
            id: subscription._id,
            planType: subscription.planType,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            status: subscription.status,
            autoPayEnabled: subscription.autoPayEnabled,
            nextBillingDate: subscription.nextBillingDate,
          },
        });
      } else {
        // Get subscription for specific clinic
        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
          res.status(404).json({
            success: false,
            message: "Clinic not found",
          });
          return;
        }

        // Check access
        if (
          clinic.adminId.toString() !== req.user.id &&
          req.user.role !== "super-admin"
        ) {
          res.status(403).json({
            success: false,
            message: "Unauthorized access",
          });
          return;
        }

        const subscription = await Subscription.findOne({ clinicId });

        if (!subscription) {
          res.status(404).json({
            success: false,
            message: "No active subscription for this clinic",
          });
          return;
        }

        res.json({
          success: true,
          subscription: {
            id: subscription._id,
            planType: subscription.planType,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            status: subscription.status,
            autoPayEnabled: subscription.autoPayEnabled,
            nextBillingDate: subscription.nextBillingDate,
          },
        });
      }
    } catch (error) {
      console.error("Get current subscription error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subscription",
      });
    }
  }
);

/**
 * POST /api/subscriptions/select
 * Select a subscription plan (requires clinic admin or super-admin)
 */
router.post(
  "/select",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validation = selectPlanSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { clinicId, planType, autoPayEnabled } = validation.data;

      // Verify clinic exists and user has access
      const clinic = await Clinic.findById(clinicId);
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: "Clinic not found",
        });
        return;
      }

      if (
        clinic.adminId.toString() !== req.user.id &&
        req.user.role !== "super-admin"
      ) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
        return;
      }

      // Get plan details
      const plan = SUBSCRIPTION_PLANS.find((p) => p.type === planType);
      if (!plan) {
        res.status(400).json({
          success: false,
          message: "Invalid plan type",
        });
        return;
      }

      // Check if subscription already exists
      const existingSubscription = await Subscription.findOne({
        clinicId,
      });

      if (existingSubscription && existingSubscription.status === "active") {
        res.status(409).json({
          success: false,
          message: "Clinic already has an active subscription",
          subscription: {
            planType: existingSubscription.planType,
            endDate: existingSubscription.endDate,
            status: existingSubscription.status,
          },
        });
        return;
      }

      // Create or update subscription
      if (existingSubscription) {
        existingSubscription.planType = planType;
        existingSubscription.autoPayEnabled = autoPayEnabled;
        existingSubscription.status = "pending_payment";
        await existingSubscription.save();
      } else {
        const subscription = new Subscription({
          clinicId,
          planType,
          startDate: new Date(),
          endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
          status: "pending_payment",
          autoPayEnabled,
          nextBillingDate: new Date(
            Date.now() + plan.duration * 24 * 60 * 60 * 1000
          ),
        });
        await subscription.save();
      }

      res.json({
        success: true,
        message: `${plan.name} selected. Proceed to payment.`,
        plan: {
          type: plan.type,
          price: plan.price,
          currency: plan.currency,
          duration: plan.duration,
        },
      });
    } catch (error) {
      console.error("Select plan error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to select subscription plan",
      });
    }
  }
);

/**
 * PUT /api/subscriptions/:id/auto-pay
 * Toggle auto-pay for subscription (requires clinic admin or super-admin)
 */
router.put(
  "/:id/auto-pay",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;

      const subscription = await Subscription.findById(req.params.id);

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
        return;
      }

      // Check access
      const clinic = await Clinic.findById(subscription.clinicId);
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: "Associated clinic not found",
        });
        return;
      }

      if (
        clinic.adminId.toString() !== req.user.id &&
        req.user.role !== "super-admin"
      ) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
        return;
      }

      subscription.autoPayEnabled = enabled;
      await subscription.save();

      res.json({
        success: true,
        message: "Auto-pay settings updated",
        autoPayEnabled: subscription.autoPayEnabled,
      });
    } catch (error) {
      console.error("Update auto-pay error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update auto-pay settings",
      });
    }
  }
);

/**
 * PUT /api/subscriptions/:id/cancel
 * Cancel subscription (requires clinic admin or super-admin)
 */
router.put(
  "/:id/cancel",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const subscription = await Subscription.findById(req.params.id);

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
        return;
      }

      // Check access
      const clinic = await Clinic.findById(subscription.clinicId);
      if (!clinic) {
        res.status(404).json({
          success: false,
          message: "Associated clinic not found",
        });
        return;
      }

      if (
        clinic.adminId.toString() !== req.user.id &&
        req.user.role !== "super-admin"
      ) {
        res.status(403).json({
          success: false,
          message: "Unauthorized access",
        });
        return;
      }

      subscription.status = "cancelled";
      subscription.endDate = new Date();
      await subscription.save();

      // Update clinic status
      clinic.status = "inactive";
      clinic.suspensionReason = "Subscription cancelled";
      await clinic.save();

      res.json({
        success: true,
        message: "Subscription cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel subscription",
      });
    }
  }
);

export default router;
