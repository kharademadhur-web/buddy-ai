import { Router, Request, Response } from "express";
import { z } from "zod";
import { Doctor } from "../models/Doctor";
import { User } from "../models/User";
import { Clinic } from "../models/Clinic";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

const router = Router();

// Validation schemas
const submitKYCSchema = z.object({
  licenseNumber: z.string().min(5, "License number is required"),
  licenseValidTill: z.string().refine((val) => {
    const date = new Date(val);
    return date > new Date();
  }, "License must be valid (expiry date must be in future)"),
  registrationNumber: z.string().min(3, "Registration number is required"),
  specialization: z.string().optional().default("General"),
  address: z.string().min(5, "Address is required"),
  aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  clinicId: z.string().optional(),
});

const updateKYCSchema = submitKYCSchema.partial();

/**
 * POST /api/doctors/kyc/submit
 * Submit doctor KYC documents (requires authentication)
 */
router.post(
  "/kyc/submit",
  authMiddleware,
  requireRole("doctor", "clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validation = submitKYCSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      // Check if doctor KYC already exists
      const existingKYC = await Doctor.findOne({ userId: req.user.id });
      if (existingKYC && existingKYC.kycStatus === "approved") {
        res.status(409).json({
          success: false,
          message: "KYC already approved for this doctor",
        });
        return;
      }

      const {
        licenseNumber,
        licenseValidTill,
        registrationNumber,
        specialization,
        address,
        aadhaar,
        pan,
        clinicId,
      } = validation.data;

      // If clinic ID provided, verify it exists and user has access
      let clinic = null;
      if (clinicId) {
        clinic = await Clinic.findById(clinicId);
        if (!clinic) {
          res.status(404).json({
            success: false,
            message: "Clinic not found",
          });
          return;
        }

        // Verify clinic admin access
        if (
          clinic.adminId.toString() !== req.user.id &&
          req.user.role !== "super-admin"
        ) {
          res.status(403).json({
            success: false,
            message: "Unauthorized clinic access",
          });
          return;
        }
      }

      // Create or update doctor KYC
      let doctor = await Doctor.findOne({ userId: req.user.id });

      if (!doctor) {
        doctor = new Doctor({
          userId: req.user.id,
          clinicId: clinicId || null,
          licenseNumber,
          licenseValidTill,
          registrationNumber,
          specialization,
          address,
          aadhaar,
          pan,
          kycStatus: "pending",
          kycDocuments: {
            aadhaar: true,
            pan: true,
            photo: false,
            signature: false,
          },
        });
      } else {
        // Update existing
        doctor.licenseNumber = licenseNumber;
        doctor.licenseValidTill = new Date(licenseValidTill);
        doctor.registrationNumber = registrationNumber;
        doctor.specialization = specialization;
        doctor.address = address;
        doctor.aadhaar = aadhaar;
        doctor.pan = pan;
        if (clinicId) doctor.clinicId = clinicId;
        doctor.kycStatus = "pending";
      }

      await doctor.save();

      // Update user role to doctor if not already
      if (req.user.role !== "doctor") {
        await User.findByIdAndUpdate(req.user.id, { role: "doctor" });
      }

      res.status(201).json({
        success: true,
        message: "KYC submitted for verification",
        doctor: {
          id: doctor._id,
          userId: doctor.userId,
          licenseNumber: doctor.licenseNumber,
          specialization: doctor.specialization,
          kycStatus: doctor.kycStatus,
          submittedAt: doctor.createdAt,
        },
      });
    } catch (error) {
      console.error("Doctor KYC submission error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit KYC",
      });
    }
  }
);

/**
 * GET /api/doctors/:id
 * Get doctor details (requires authentication)
 */
router.get(
  "/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const doctor = await Doctor.findById(req.params.id);

      if (!doctor) {
        res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
        return;
      }

      // Check access: self, clinic admin, or super-admin
      if (
        doctor.userId.toString() !== req.user.id &&
        req.user.role !== "super-admin"
      ) {
        // Check if user is clinic admin
        if (doctor.clinicId) {
          const clinic = await Clinic.findById(doctor.clinicId);
          if (!clinic || clinic.adminId.toString() !== req.user.id) {
            res.status(403).json({
              success: false,
              message: "Unauthorized access",
            });
            return;
          }
        } else {
          res.status(403).json({
            success: false,
            message: "Unauthorized access",
          });
          return;
        }
      }

      res.json({
        success: true,
        doctor: {
          id: doctor._id,
          userId: doctor.userId,
          clinicId: doctor.clinicId,
          licenseNumber: doctor.licenseNumber,
          licenseValidTill: doctor.licenseValidTill,
          registrationNumber: doctor.registrationNumber,
          specialization: doctor.specialization,
          address: doctor.address,
          kycStatus: doctor.kycStatus,
          kycDocuments: doctor.kycDocuments,
          createdAt: doctor.createdAt,
        },
      });
    } catch (error) {
      console.error("Get doctor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch doctor details",
      });
    }
  }
);

/**
 * GET /api/doctors/user/:userId
 * Get doctor profile by user ID (requires authentication)
 */
router.get(
  "/user/:userId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const doctor = await Doctor.findOne({ userId: req.params.userId });

      if (!doctor) {
        res.status(404).json({
          success: false,
          message: "Doctor profile not found",
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
        doctor: {
          id: doctor._id,
          userId: doctor.userId,
          clinicId: doctor.clinicId,
          licenseNumber: doctor.licenseNumber,
          specialization: doctor.specialization,
          kycStatus: doctor.kycStatus,
          createdAt: doctor.createdAt,
        },
      });
    } catch (error) {
      console.error("Get user doctor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch doctor profile",
      });
    }
  }
);

/**
 * PUT /api/doctors/:id
 * Update doctor details (requires doctor self or clinic admin or super-admin)
 */
router.put(
  "/:id",
  authMiddleware,
  requireRole("doctor", "clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = updateKYCSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const doctor = await Doctor.findById(req.params.id);

      if (!doctor) {
        res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
        return;
      }

      // Check access
      if (
        doctor.userId.toString() !== req.user.id &&
        req.user.role !== "super-admin"
      ) {
        if (doctor.clinicId) {
          const clinic = await Clinic.findById(doctor.clinicId);
          if (!clinic || clinic.adminId.toString() !== req.user.id) {
            res.status(403).json({
              success: false,
              message: "Unauthorized access",
            });
            return;
          }
        } else {
          res.status(403).json({
            success: false,
            message: "Unauthorized access",
          });
          return;
        }
      }

      // Update doctor
      const updateData = validation.data;
      Object.assign(doctor, updateData);
      // Reset KYC status when updating
      if (Object.keys(updateData).some((key) => key !== "clinicId")) {
        doctor.kycStatus = "pending";
      }
      await doctor.save();

      res.json({
        success: true,
        message: "Doctor profile updated successfully",
        doctor: {
          id: doctor._id,
          licenseNumber: doctor.licenseNumber,
          specialization: doctor.specialization,
          kycStatus: doctor.kycStatus,
        },
      });
    } catch (error) {
      console.error("Update doctor error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update doctor profile",
      });
    }
  }
);

/**
 * GET /api/doctors/clinic/:clinicId
 * Get all doctors in a clinic (requires clinic admin or super-admin)
 */
router.get(
  "/clinic/:clinicId",
  authMiddleware,
  requireRole("clinic", "super-admin"),
  async (req: Request, res: Response) => {
    try {
      const clinic = await Clinic.findById(req.params.clinicId);

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

      const doctors = await Doctor.find({ clinicId: req.params.clinicId });

      res.json({
        success: true,
        doctors: doctors.map((doc) => ({
          id: doc._id,
          userId: doc.userId,
          licenseNumber: doc.licenseNumber,
          specialization: doc.specialization,
          kycStatus: doc.kycStatus,
          createdAt: doc.createdAt,
        })),
      });
    } catch (error) {
      console.error("Get clinic doctors error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch clinic doctors",
      });
    }
  }
);

export default router;
