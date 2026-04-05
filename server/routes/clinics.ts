import { Router, Request, Response } from "express";
import { z } from "zod";
import { Clinic } from "../models/Clinic";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

const router = Router();

// Validation schemas
const createClinicSchema = z.object({
  name: z.string().min(2, "Clinic name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  location: z.string().min(2, "Location is required"),
  address: z.string().min(5, "Address is required"),
});

const updateClinicSchema = createClinicSchema.partial();

/**
 * POST /api/clinics/register
 * Register a new clinic (requires authentication)
 */
router.post(
  "/register",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validation = createClinicSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { name, email, phone, location, address } = validation.data;

      // Check if clinic already exists for this user
      const existingClinic = await Clinic.findOne({ adminId: req.user.id });
      if (existingClinic) {
        res.status(409).json({
          success: false,
          message: "You already have a registered clinic",
        });
        return;
      }

      // Create new clinic
      const clinic = new Clinic({
        name,
        email,
        phone,
        location,
        address,
        adminId: req.user.id,
        status: "active",
      });

      await clinic.save();

      res.status(201).json({
        success: true,
        message: "Clinic registered successfully",
        clinic: {
          id: clinic._id,
          name: clinic.name,
          email: clinic.email,
          phone: clinic.phone,
          location: clinic.location,
          status: clinic.status,
        },
      });
    } catch (error) {
      console.error("Clinic registration error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to register clinic",
      });
    }
  }
);

/**
 * GET /api/clinics/:id
 * Get clinic details (requires authentication)
 */
router.get(
  "/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const clinic = await Clinic.findById(req.params.id);

      if (!clinic) {
        res.status(404).json({
          success: false,
          message: "Clinic not found",
        });
        return;
      }

      // Check access: user must be admin of clinic or super-admin
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
        clinic: {
          id: clinic._id,
          name: clinic.name,
          email: clinic.email,
          phone: clinic.phone,
          location: clinic.location,
          address: clinic.address,
          status: clinic.status,
          subscriptionId: clinic.subscriptionId,
          createdAt: clinic.createdAt,
        },
      });
    } catch (error) {
      console.error("Get clinic error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch clinic details",
      });
    }
  }
);

/**
 * PUT /api/clinics/:id
 * Update clinic details (requires clinic admin or super-admin)
 */
router.put(
  "/:id",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = updateClinicSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const clinic = await Clinic.findById(req.params.id);

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

      // Update clinic
      Object.assign(clinic, validation.data);
      await clinic.save();

      res.json({
        success: true,
        message: "Clinic updated successfully",
        clinic: {
          id: clinic._id,
          name: clinic.name,
          email: clinic.email,
          phone: clinic.phone,
          location: clinic.location,
          address: clinic.address,
          status: clinic.status,
        },
      });
    } catch (error) {
      console.error("Update clinic error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update clinic",
      });
    }
  }
);

/**
 * GET /api/clinics/user/:userId
 * Get user's clinic (requires authentication)
 */
router.get(
  "/user/:userId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const clinic = await Clinic.findOne({ adminId: req.params.userId });

      if (!clinic) {
        res.status(404).json({
          success: false,
          message: "Clinic not found for this user",
        });
        return;
      }

      // Check access
      if (
        req.params.userId !== req.user.id &&
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
        clinic: {
          id: clinic._id,
          name: clinic.name,
          email: clinic.email,
          phone: clinic.phone,
          location: clinic.location,
          address: clinic.address,
          status: clinic.status,
          subscriptionId: clinic.subscriptionId,
        },
      });
    } catch (error) {
      console.error("Get user clinic error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch clinic details",
      });
    }
  }
);

export default router;
