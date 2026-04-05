import { Router, Request, Response } from "express";
import { z } from "zod";
import { Payment } from "../models/Payment";
import { Subscription } from "../models/Subscription";
import { Clinic } from "../models/Clinic";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import crypto from "crypto";

const router = Router();

// Validation schemas
const createOrderSchema = z.object({
  clinicId: z.string().min(1, "Clinic ID is required"),
  planType: z.enum(["monthly", "yearly"], {
    errorMap: () => ({ message: "Invalid plan type" }),
  }),
  amount: z.number().min(99, "Amount must be at least 99"),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  paymentId: z.string().min(1, "Payment ID is required"),
  signature: z.string().min(1, "Signature is required"),
});

// Plan pricing (in INR)
const PLAN_PRICING = {
  monthly: 999,
  yearly: 9999,
};

/**
 * POST /api/payments/create-order
 * Create a payment order (requires clinic admin or super-admin)
 */
router.post(
  "/create-order",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validation = createOrderSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { clinicId, planType, amount } = validation.data;

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

      // Verify amount matches plan
      const expectedAmount = PLAN_PRICING[planType];
      if (amount !== expectedAmount) {
        res.status(400).json({
          success: false,
          message: `Invalid amount for ${planType} plan. Expected: ${expectedAmount}`,
        });
        return;
      }

      // Generate Razorpay-like order ID (mock)
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create payment record
      const payment = new Payment({
        clinicId,
        amount,
        method: "card",
        status: "pending",
        orderId,
        planType,
      });

      await payment.save();

      res.status(201).json({
        success: true,
        message: "Order created successfully",
        order: {
          id: payment._id,
          orderId,
          amount,
          planType,
          currency: "INR",
          // Mock Razorpay response structure
          razorpayOrderId: orderId,
          notes: {
            clinicId,
          },
        },
      });
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create payment order",
      });
    }
  }
);

/**
 * POST /api/payments/verify
 * Verify payment (requires clinic admin or super-admin)
 */
router.post(
  "/verify",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validation = verifyPaymentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { orderId, paymentId, signature } = validation.data;

      // Find payment by orderId
      const payment = await Payment.findOne({ orderId });

      if (!payment) {
        res.status(404).json({
          success: false,
          message: "Payment order not found",
        });
        return;
      }

      // Verify clinic access
      if (
        payment.clinicId.toString() !== req.user.id &&
        req.user.role !== "super-admin"
      ) {
        // For clinic admin, check if they own the clinic
        const clinic = await Clinic.findById(payment.clinicId);
        if (!clinic || clinic.adminId.toString() !== req.user.id) {
          res.status(403).json({
            success: false,
            message: "Unauthorized access",
          });
          return;
        }
      }

      // TODO: In production, verify with Razorpay API using:
      // const generatedSignature = crypto
      //   .createHmac("sha256", RAZORPAY_SECRET)
      //   .update(`${orderId}|${paymentId}`)
      //   .digest("hex");
      // if (generatedSignature !== signature) {
      //   return res.status(400).json({ success: false, message: "Invalid signature" });
      // }

      // Mock verification - in production, call Razorpay API
      const isValidPayment = paymentId.length > 5 && signature.length > 5;

      if (!isValidPayment) {
        res.status(400).json({
          success: false,
          message: "Invalid payment details",
        });
        return;
      }

      // Update payment status
      payment.status = "completed";
      payment.paymentId = paymentId;
      payment.signature = signature;
      payment.completedAt = new Date();
      await payment.save();

      // Create or update subscription
      const clinic = await Clinic.findById(payment.clinicId);
      if (clinic) {
        let subscription = await Subscription.findOne({
          clinicId: payment.clinicId,
        });

        if (!subscription) {
          subscription = new Subscription({
            clinicId: payment.clinicId,
            planType: payment.planType || "monthly",
            startDate: new Date(),
            endDate: new Date(
              Date.now() +
                (payment.planType === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000
            ),
            status: "active",
            autoPayEnabled: true,
            nextBillingDate: new Date(
              Date.now() +
                (payment.planType === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000
            ),
          });
        } else {
          subscription.planType = payment.planType || subscription.planType;
          subscription.endDate = new Date(
            Date.now() +
              (payment.planType === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000
          );
          subscription.status = "active";
          subscription.nextBillingDate = new Date(
            Date.now() +
              (payment.planType === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000
          );
        }

        await subscription.save();

        // Update clinic subscription reference
        clinic.subscriptionId = subscription._id;
        clinic.status = "active";
        await clinic.save();
      }

      res.json({
        success: true,
        message: "Payment verified successfully",
        payment: {
          id: payment._id,
          status: payment.status,
          orderId: payment.orderId,
          amount: payment.amount,
          completedAt: payment.completedAt,
        },
        subscription: {
          planType: payment.planType,
          validUntil: new Date(
            Date.now() +
              (payment.planType === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000
          ),
        },
      });
    } catch (error) {
      console.error("Verify payment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify payment",
      });
    }
  }
);

/**
 * GET /api/payments/history
 * Get payment history (requires clinic admin or super-admin)
 */
router.get(
  "/history",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      // Get query parameters
      const clinicId = req.query.clinicId as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      let query: Record<string, any> = {};

      if (clinicId) {
        // Verify clinic access
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

        query.clinicId = clinicId;
      } else if (req.user.role === "clinic") {
        // Clinic users can only see their own payments
        const clinic = await Clinic.findOne({ adminId: req.user.id });
        if (clinic) {
          query.clinicId = clinic._id;
        }
      }

      // Fetch payments
      const payments = await Payment.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);

      const total = await Payment.countDocuments(query);

      res.json({
        success: true,
        payments: payments.map((p) => ({
          id: p._id,
          orderId: p.orderId,
          amount: p.amount,
          method: p.method,
          status: p.status,
          planType: p.planType,
          createdAt: p.createdAt,
          completedAt: p.completedAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error("Get payment history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment history",
      });
    }
  }
);

/**
 * GET /api/payments/:id
 * Get payment details (requires clinic admin or super-admin)
 */
router.get(
  "/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const payment = await Payment.findById(req.params.id);

      if (!payment) {
        res.status(404).json({
          success: false,
          message: "Payment not found",
        });
        return;
      }

      // Check access
      const clinic = await Clinic.findById(payment.clinicId);
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

      res.json({
        success: true,
        payment: {
          id: payment._id,
          orderId: payment.orderId,
          paymentId: payment.paymentId,
          amount: payment.amount,
          method: payment.method,
          status: payment.status,
          planType: payment.planType,
          createdAt: payment.createdAt,
          completedAt: payment.completedAt,
        },
      });
    } catch (error) {
      console.error("Get payment error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch payment",
      });
    }
  }
);

export default router;
