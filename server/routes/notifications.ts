import { Router, Request, Response } from "express";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { asyncHandler, ValidationError } from "../middleware/error-handler.middleware";
import { subscribeUserNotifications } from "../services/app-notifications.service";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

/**
 * GET /api/notifications/stream
 * SSE stream — doctor/receptionist subscribes on login.
 * Accepts auth via Authorization header OR ?token= query param (required for EventSource).
 */
router.get(
  "/stream",
  (req: Request, res: Response, next) => {
    // Allow token via query param for EventSource (which cannot set headers)
    const queryToken = (req.query as { token?: string }).token;
    if (queryToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }
    next();
  },
  authMiddleware,
  (req: Request, res: Response) => {
    if (!req.user) return sendJsonError(res, 401, "Unauthorized", "UNAUTHORIZED");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Send initial hello
    res.write(`event: connected\ndata: ${JSON.stringify({ userId: req.user.userId })}\n\n`);

    // Send keepalive every 25s
    const keepalive = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 25_000);

    const unsubscribe = subscribeUserNotifications(req.user.userId, (notification) => {
      res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
    });

    req.on("close", () => {
      clearInterval(keepalive);
      unsubscribe();
      res.end();
    });
  }
);

/**
 * GET /api/notifications
 * Fetch paginated notifications for the current user.
 */
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ValidationError("Unauthorized");

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
    const unreadOnly = req.query.unread === "true";
    const offset = (page - 1) * limit;

    const supabase = getSupabaseClient();
    let q = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) q = q.eq("is_read", false);

    const { data, error, count } = await q;
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");

    return res.json({ success: true, notifications: data ?? [], total: count ?? 0, page, limit });
  })
);

/**
 * GET /api/notifications/unread-count
 * Returns count of unread notifications for the badge.
 */
router.get(
  "/unread-count",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ValidationError("Unauthorized");

    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.userId)
      .eq("is_read", false);

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, count: count ?? 0 });
  })
);

/**
 * POST /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.post(
  "/:id/read",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ValidationError("Unauthorized");
    const { id } = req.params;

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.userId);

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true });
  })
);

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read.
 */
router.post(
  "/read-all",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ValidationError("Unauthorized");

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", req.user.userId)
      .eq("is_read", false);

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true });
  })
);

/**
 * POST /api/notifications/push-subscribe
 * Store a Web Push subscription for this user/device.
 */
router.post(
  "/push-subscribe",
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new ValidationError("Unauthorized");
    const { endpoint, keys } = req.body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new ValidationError("endpoint and keys (p256dh, auth) are required");
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: req.user.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth_key: keys.auth,
        user_agent: req.headers["user-agent"] || null,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true });
  })
);

export default router;
