import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error-handler.middleware";
import { grokConsultationSummary, isXaiConfigured } from "../services/xai-grok.service";
import { sendJsonError } from "../lib/send-json-error";

const router = Router();

/**
 * GET /api/ai/formulary?q=&limit=
 * Ranked text search over drug_formulary (service role; no PHI).
 */
router.get(
  "/formulary",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 50);
    const supabase = getSupabaseClient();

    const safe = q.replace(/[%_]/g, "").slice(0, 80);
    let query = supabase
      .from("drug_formulary")
      .select("id, code, name, strength, form, atc_code, regulatory_notes")
      .eq("is_active", true)
      .limit(limit);

    if (safe.length > 0) {
      const pat = `%${safe}%`;
      query = query.or(`name.ilike.${pat},code.ilike.${pat}`);
    }

    const { data, error } = await query.order("name", { ascending: true });
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, drugs: data ?? [] });
  })
);

const suggestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(30).optional(),
});

/**
 * POST /api/ai/medication-suggest
 * Formulary-backed suggestions (same as search; placeholder for future RAG).
 */
router.post(
  "/medication-suggest",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = suggestSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");
    const supabase = getSupabaseClient();
    const take = parsed.data.limit ?? 15;
    const safeQ = parsed.data.query.replace(/[%_]/g, "").slice(0, 80);
    const like = `%${safeQ}%`;
    const { data, error } = await supabase
      .from("drug_formulary")
      .select("id, code, name, strength, form, atc_code, regulatory_notes")
      .eq("is_active", true)
      .or(`name.ilike.${like},code.ilike.${like}`)
      .order("name", { ascending: true })
      .limit(take);
    if (error) return sendJsonError(res, 500, error.message, "INTERNAL_SERVER_ERROR");
    return res.json({ success: true, suggestions: data ?? [] });
  })
);

const summarySchema = z.object({
  transcript: z.string().min(3),
  recordingConsent: z.literal(true),
});

/**
 * POST /api/ai/consultation-summary
 * Consent-gated stub summary (extend with LLM + BAA when configured).
 */
router.post(
  "/consultation-summary",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = summarySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "recordingConsent must be true and transcript is required",
        details: parsed.error.flatten(),
      });
    }

    const text = parsed.data.transcript.trim();

    if (isXaiConfigured()) {
      try {
        const g = await grokConsultationSummary(text);
        const englishPhrase = [g.chiefComplaint, g.plan].filter(Boolean).join(" — ").slice(0, 400);
        return res.json({
          success: true,
          summary: {
            chiefComplaint: g.chiefComplaint,
            history: g.history,
            plan: g.plan,
            englishPhrase,
            disclaimer: "Draft for clinician review only — Grok/xAI; not a diagnosis.",
            provider: "xai",
          },
        });
      } catch (e) {
        console.warn("[ai] Grok failed, falling back to local stub:", e);
      }
    }

    const sentences = text.split(/[.!?]\s+/).filter(Boolean);
    const chief = sentences[0] ?? text.slice(0, 200);
    const plan = sentences.slice(1, 3).join(". ") || "Review findings and adjust plan clinically.";

    const englishPhrase = [chief, plan].filter(Boolean).join(" — ").slice(0, 400);
    return res.json({
      success: true,
      summary: {
        chiefComplaint: chief,
        history: text.slice(0, 800),
        plan,
        englishPhrase,
        disclaimer: "Draft for clinician review only — not a medical diagnosis.",
        provider: "stub",
      },
    });
  })
);

export default router;
