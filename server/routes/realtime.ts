import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { realtimeService } from "../services/realtime.service";
import type { RealtimeEvent } from "@shared/api";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

/**
 * GET /api/realtime/clinic/:clinicId/events
 * Server-Sent Events stream of clinic events.
 */
router.get(
  "/clinic/:clinicId/events",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  (req: Request, res: Response) => {
    const { clinicId } = req.params;
    if (req.user?.role !== "super-admin" && req.user?.clinicId !== clinicId) {
      return sendJsonError(res, 403, "Clinic access denied", "FORBIDDEN");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event: RealtimeEvent) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // initial hello
    send({
      type: "appointment.created",
      clinicId,
      at: new Date().toISOString(),
      payload: { hello: true },
    } as any);

    const unsubscribe = realtimeService.subscribe(clinicId, send);

    req.on("close", () => {
      unsubscribe();
      res.end();
    });
  }
);

export default router;

