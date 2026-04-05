import { RequestHandler } from "express";
import { Clinic } from "../models/Clinic.js";

/**
 * Toggle read-only mode for a clinic
 * Admin can suspend clinic access by setting read-only mode
 */
export const toggleClinicAccess: RequestHandler = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { readOnlyMode, readOnlyReason } = req.body;

    const clinic = await Clinic.findByIdAndUpdate(
      clinicId,
      {
        readOnlyMode,
        readOnlyReason: readOnlyReason || null,
      },
      { new: true }
    );

    if (!clinic) {
      res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
      return;
    }

    res.json({
      success: true,
      message: `Clinic access ${readOnlyMode ? "disabled" : "enabled"}`,
      data: {
        clinicId: clinic._id,
        readOnlyMode: clinic.readOnlyMode,
        readOnlyReason: clinic.readOnlyReason,
      },
    });
  } catch (error) {
    console.error("Error toggling clinic access:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle clinic access",
    });
  }
};

/**
 * Get clinic access status
 */
export const getClinicAccessStatus: RequestHandler = async (req, res) => {
  try {
    const { clinicId } = req.params;

    const clinic = await Clinic.findById(clinicId, {
      name: 1,
      readOnlyMode: 1,
      readOnlyReason: 1,
      paymentStatus: 1,
    });

    if (!clinic) {
      res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        clinicId: clinic._id,
        clinicName: clinic.name,
        readOnlyMode: clinic.readOnlyMode,
        readOnlyReason: clinic.readOnlyReason,
        paymentStatus: clinic.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Error getting clinic access status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get clinic access status",
    });
  }
};
