import { Router, Request, Response } from "express";
import { z } from "zod";
import { Queue } from "../models/Queue";
import { authMiddleware } from "../middleware/auth.middleware";
import { AuditLog } from "../models/AuditLog";

const router = Router();

// Validation schemas
const addToQueueSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  clinicId: z.string().min(1, "Clinic ID is required"),
  notes: z.string().optional(),
});

const updateQueueStatusSchema = z.object({
  status: z.enum([
    "waiting",
    "called",
    "in_consultation",
    "completed",
    "left",
  ]),
});

/**
 * GET /api/queue/:clinicId
 * Get current queue for a clinic (live queue display)
 */
router.get(
  "/:clinicId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const queue = await Queue.find({
        clinicId: req.params.clinicId,
        status: { $in: ["waiting", "called", "in_consultation"] },
      })
        .sort({ position: 1 })
        .lean();

      // Calculate estimated wait time (assume 10 min per consultation)
      const enrichedQueue = queue.map((item, index) => ({
        ...item,
        position: index + 1,
        estimatedWaitTime: (index + 1) * 10, // minutes
      }));

      res.json({
        success: true,
        queue: enrichedQueue,
        count: enrichedQueue.length,
      });
    } catch (error) {
      console.error("Get queue error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch queue",
      });
    }
  }
);

/**
 * POST /api/queue/add
 * Add patient to queue (reception staff)
 */
router.post("/add", authMiddleware, async (req: Request, res: Response) => {
  try {
    const validation = addToQueueSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { patientId, clinicId, notes } = validation.data;

    // Check if patient already in queue
    const existingQueue = await Queue.findOne({
      patientId,
      clinicId,
      status: { $in: ["waiting", "called", "in_consultation"] },
    });

    if (existingQueue) {
      res.status(400).json({
        success: false,
        message: "Patient already in queue",
      });
      return;
    }

    // Get next position
    const lastQueue = await Queue.findOne({ clinicId })
      .sort({ position: -1 })
      .lean();
    const nextPosition = (lastQueue?.position || 0) + 1;

    // Add to queue
    const queueEntry = new Queue({
      patientId,
      clinicId,
      status: "waiting",
      position: nextPosition,
      checkedInAt: new Date(),
      notes,
    });

    await queueEntry.save();

    // Log audit
    await AuditLog.create({
      userId: req.user?.userId,
      action: "create_patient",
      resourceType: "queue",
      resourceId: queueEntry._id.toString(),
      clinicId,
      description: `Added patient to queue - Position ${nextPosition}`,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json({
      success: true,
      queueEntry,
      position: nextPosition,
      message: "Patient added to queue",
    });
  } catch (error) {
    console.error("Add to queue error:", error);
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to add to queue",
    });
  }
});

/**
 * PUT /api/queue/:id/status
 * Update patient queue status
 */
router.put(
  "/:id/status",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const validation = updateQueueStatusSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          errors: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { status } = validation.data;

      const updateData: Record<string, any> = { status };

      // Set timestamps based on status
      if (status === "called") {
        updateData.calledAt = new Date();
      } else if (status === "in_consultation") {
        updateData.consultationStartedAt = new Date();
      } else if (status === "completed") {
        updateData.completedAt = new Date();
      } else if (status === "left") {
        updateData.leftAt = new Date();
      }

      const queueEntry = await Queue.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );

      if (!queueEntry) {
        res.status(404).json({
          success: false,
          message: "Queue entry not found",
        });
        return;
      }

      // If status changed to completed or left, shift remaining patients up
      if (["completed", "left"].includes(status)) {
        await Queue.updateMany(
          {
            clinicId: queueEntry.clinicId,
            position: { $gt: queueEntry.position },
            status: { $in: ["waiting", "called"] },
          },
          { $inc: { position: -1 } }
        );
      }

      // Log audit
      await AuditLog.create({
        userId: req.user?.userId,
        action: "create_patient",
        resourceType: "queue",
        resourceId: queueEntry._id.toString(),
        clinicId: queueEntry.clinicId,
        description: `Updated queue status to ${status}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        success: true,
        queueEntry,
        message: `Queue status updated to ${status}`,
      });
    } catch (error) {
      console.error("Update queue status error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update queue",
      });
    }
  }
);

/**
 * GET /api/queue/:clinicId/completed
 * Get completed consultations for a clinic (for dashboard/reporting)
 */
router.get(
  "/:clinicId/completed",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { limit = 10 } = req.query;

      const completed = await Queue.find({
        clinicId: req.params.clinicId,
        status: "completed",
      })
        .sort({ completedAt: -1 })
        .limit(parseInt(limit as string))
        .lean();

      res.json({
        success: true,
        completed,
      });
    } catch (error) {
      console.error("Get completed queue error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch completed",
      });
    }
  }
);

export default router;
