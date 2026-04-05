import { RequestHandler } from "express";
import {
  getTotalRevenue,
  getTotalPendingAmount,
  getRevenueTrend,
  getPendingByClinic,
  getDashboardAnalytics,
} from "../services/analytics.service.js";

/**
 * Get total revenue earned
 */
export const getTotalRevenueHandler: RequestHandler = async (req, res) => {
  try {
    const totalRevenue = await getTotalRevenue();

    res.json({
      success: true,
      data: {
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Error getting total revenue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get total revenue",
    });
  }
};

/**
 * Get total pending amount
 */
export const getTotalPendingHandler: RequestHandler = async (req, res) => {
  try {
    const totalPending = await getTotalPendingAmount();

    res.json({
      success: true,
      data: {
        totalPending,
      },
    });
  } catch (error) {
    console.error("Error getting total pending:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get total pending amount",
    });
  }
};

/**
 * Get revenue trend (monthly or daily)
 */
export const getRevenueTrendHandler: RequestHandler = async (req, res) => {
  try {
    const { period = "month", limit = 12 } = req.query;

    const trend = await getRevenueTrend(
      (period as "month" | "day") || "month",
      parseInt(limit as string) || 12
    );

    res.json({
      success: true,
      data: {
        period,
        trend,
      },
    });
  } catch (error) {
    console.error("Error getting revenue trend:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get revenue trend",
    });
  }
};

/**
 * Get pending amounts by clinic
 */
export const getPendingByClinicHandler: RequestHandler = async (
  req,
  res
) => {
  try {
    const { limit = 10 } = req.query;

    const data = await getPendingByClinic(parseInt(limit as string) || 10);

    res.json({
      success: true,
      data: {
        pendingByClinic: data,
      },
    });
  } catch (error) {
    console.error("Error getting pending by clinic:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get pending by clinic",
    });
  }
};

/**
 * Get comprehensive dashboard analytics
 */
export const getDashboardAnalyticsHandler: RequestHandler = async (
  req,
  res
) => {
  try {
    const analytics = await getDashboardAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Error getting dashboard analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard analytics",
    });
  }
};
