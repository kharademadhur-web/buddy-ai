import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { sendJsonError } from "../lib/send-json-error";
import { MEDICINES_CATALOG } from "../data/medicines-catalog";

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

/**
 * GET /api/medicines/search?q=&limit=
 * Authenticated clinic staff — curated formulary search (substring match, case-insensitive).
 */
router.get(
  "/search",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  (req: Request, res: Response) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid query", "VALIDATION_ERROR");

    const q = parsed.data.q.trim().toLowerCase();
    const limit = parsed.data.limit;

    let rows = MEDICINES_CATALOG;
    if (q.length > 0) {
      rows = MEDICINES_CATALOG.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.dosage.toLowerCase().includes(q)
      );
    }

    const results = rows.slice(0, limit).map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
    }));

    return res.json({
      success: true,
      query: parsed.data.q,
      count: results.length,
      results,
    });
  }
);

export default router;
