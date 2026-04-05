import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware.js";
import {
  getTotalRevenueHandler,
  getTotalPendingHandler,
  getRevenueTrendHandler,
  getPendingByClinicHandler,
  getDashboardAnalyticsHandler,
} from "../controllers/analytics.controller.js";

const router = Router();

/**
 * All analytics routes are protected and require super-admin role
 */

/**
 * GET /api/analytics/revenue
 * Get total revenue earned (sum of all paid payments)
 */
router.get(
  "/revenue",
  authMiddleware,
  requireRole("super-admin"),
  getTotalRevenueHandler
);

/**
 * GET /api/analytics/pending
 * Get total pending amount (sum of pending/overdue payments)
 */
router.get(
  "/pending",
  authMiddleware,
  requireRole("super-admin"),
  getTotalPendingHandler
);

/**
 * GET /api/analytics/revenue-trend
 * Get revenue trend by month/day
 * Query params: period=month|day, limit=12 (default)
 */
router.get(
  "/revenue-trend",
  authMiddleware,
  requireRole("super-admin"),
  getRevenueTrendHandler
);

/**
 * GET /api/analytics/pending-by-clinic
 * Get pending amounts by clinic (top clinics with pending payments)
 * Query params: limit=10 (default)
 */
router.get(
  "/pending-by-clinic",
  authMiddleware,
  requireRole("super-admin"),
  getPendingByClinicHandler
);

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard analytics (all metrics)
 */
router.get(
  "/dashboard",
  authMiddleware,
  requireRole("super-admin"),
  getDashboardAnalyticsHandler
);

export default router;
