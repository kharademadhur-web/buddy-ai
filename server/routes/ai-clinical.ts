import { Router, Request, Response } from "express";
import { z } from "zod";
import { getSupabaseClient } from "../config/supabase";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error-handler.middleware";
import { grokConsultationSummary, isXaiConfigured } from "../services/xai-grok.service";
import {
  isHandwritingVisionConfigured,
  transcribeHandwritingImage,
} from "../services/handwriting-vision.service";
import type { HandwritingTranscribeResponse } from "@shared/api";
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

const handwritingSchema = z.object({
  /** PNG as data URL or raw base64 */
  imageBase64: z
    .string()
    .min(80)
    .max(4_000_000)
    .refine((s) => s.startsWith("data:image/") || /^[A-Za-z0-9+/=\s]+$/.test(s), {
      message: "Expected a data:image/... URL or base64 payload",
    }),
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

    /** Stub: real speech often has no `.` — split on newlines, em-dash, or commas before falling back. */
    const bySentence = text.split(/[.!?]\s+/).map((s) => s.trim()).filter(Boolean);
    const byBreak = text.split(/\s*[—\n]\s*|\s{2,}/).map((s) => s.trim()).filter(Boolean);
    const byComma = text.split(/,\s+/).map((s) => s.trim()).filter(Boolean);

    let chief: string;
    let plan: string;
    if (bySentence.length >= 2) {
      chief = bySentence[0]!.slice(0, 200);
      plan = bySentence.slice(1, 4).join(". ").slice(0, 280) || "Review findings and adjust plan clinically.";
    } else if (byBreak.length >= 2) {
      chief = byBreak[0]!.slice(0, 200);
      plan = byBreak.slice(1).join(" — ").slice(0, 280);
    } else if (byComma.length >= 2) {
      chief = byComma[0]!.slice(0, 200);
      plan = byComma.slice(1).join(", ").slice(0, 280);
    } else {
      const t = text.trim();
      const mid = Math.max(40, Math.min(140, Math.floor(t.length / 2)));
      chief = t.slice(0, mid).trim() || t.slice(0, 200);
      plan =
        t.length > mid
          ? `${t.slice(mid).trim()} — Review clinically.`.slice(0, 280)
          : "Review findings and adjust plan clinically.";
    }

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

/**
 * POST /api/ai/handwriting-transcribe
 * Rasterized pad image → plain text (vision model). PHI: treat like clinical data; keys on server only.
 */
router.post(
  "/handwriting-transcribe",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = handwritingSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");
    }

    const visionOk = isHandwritingVisionConfigured();

    if (!visionOk) {
      return sendJsonError(
        res,
        503,
        "Handwriting transcription is not configured. Set OPENAI_API_KEY (recommended) or XAI_API_KEY with a vision-capable model.",
        "SERVICE_UNAVAILABLE"
      );
    }

    try {
      const { text, provider } = await transcribeHandwritingImage(parsed.data.imageBase64);
      const body: HandwritingTranscribeResponse = {
        success: true,
        text: text.trim(),
        provider,
        disclaimer: "Draft transcription — verify before saving. Not a medical diagnosis.",
      };
      return res.json(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transcription failed";
      console.warn("[ai] handwriting-transcribe:", msg);
      return sendJsonError(res, 502, msg, "BAD_GATEWAY");
    }
  })
);

export default router;
