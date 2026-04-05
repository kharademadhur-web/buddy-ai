import { Payment } from "../models/Payment.js";
import { Clinic } from "../models/Clinic.js";

/**
 * Service to calculate analytics data
 * - Total revenue (paid amounts)
 * - Total pending amounts
 * - Revenue trends
 * - Pending amounts by clinic
 */

/**
 * Get total revenue earned (all paid payments)
 * @returns Total revenue amount
 */
export async function getTotalRevenue(): Promise<number> {
  const result = await Payment.aggregate([
    { $match: { status: "paid" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return result.length > 0 ? result[0].total : 0;
}

/**
 * Get total pending amount (all pending/overdue payments)
 * @returns Total pending amount
 */
export async function getTotalPendingAmount(): Promise<number> {
  const result = await Payment.aggregate([
    { $match: { status: { $in: ["pending", "overdue"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return result.length > 0 ? result[0].total : 0;
}

/**
 * Get revenue trend by month/day
 * @param period "month" | "day"
 * @param limit Number of periods to return (default: 12 months or 30 days)
 * @returns Array of { date, amount } sorted by date
 */
export async function getRevenueTrend(
  period: "month" | "day" = "month",
  limit: number = 12
): Promise<any[]> {
  const dateFormat =
    period === "month" ? "%Y-%m" : "%Y-%m-%d";

  const result = await Payment.aggregate([
    {
      $match: { status: "paid" },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: "$transactionDate",
          },
        },
        amount: { $sum: "$amount" },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $limit: limit,
    },
  ]);

  return result.map((item: any) => ({
    date: item._id,
    amount: item.amount,
  }));
}

/**
 * Get pending amounts by clinic
 * @param limit Number of clinics to return (default: 10)
 * @returns Array of { clinicId, clinicName, amount } sorted by amount desc
 */
export async function getPendingByClinic(limit: number = 10): Promise<any[]> {
  const result = await Payment.aggregate([
    {
      $match: { status: { $in: ["pending", "overdue"] } },
    },
    {
      $group: {
        _id: "$clinicId",
        amount: { $sum: "$amount" },
      },
    },
    {
      $sort: { amount: -1 },
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: "clinics",
        localField: "_id",
        foreignField: "_id",
        as: "clinic",
      },
    },
    {
      $unwind: "$clinic",
    },
    {
      $project: {
        clinicId: "$_id",
        clinicName: "$clinic.name",
        amount: 1,
        _id: 0,
      },
    },
  ]);

  return result;
}

/**
 * Get comprehensive analytics dashboard data
 * @returns Object containing all key metrics
 */
export async function getDashboardAnalytics(): Promise<any> {
  const [totalRevenue, totalPending, revenueTrend, pendingByClinic] =
    await Promise.all([
      getTotalRevenue(),
      getTotalPendingAmount(),
      getRevenueTrend("month", 12),
      getPendingByClinic(10),
    ]);

  return {
    totalRevenue,
    totalPending,
    revenueTrend,
    pendingByClinic,
  };
}

/**
 * Calculate clinic inactivity count
 * Returns number of inactive users (doctors/receptionists) in a clinic
 * @param clinicId Clinic ID
 * @returns Count of inactive users
 */
export async function getInactiveUsersCount(clinicId: string): Promise<number> {
  // This will be implemented as we connect to user data
  // For now, it's a placeholder
  return 0;
}
