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
        "Handwriting transcription is not configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or XAI_API_KEY with a vision-capable model.",
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

// ────────────────────────────────────────────────────────────
// POST /api/ai/handwriting-to-text
// Handwriting image → structured medicines JSON
// ────────────────────────────────────────────────────────────
const hwStructuredSchema = z.object({
  imageBase64: z
    .string()
    .min(80)
    .max(4_000_000)
    .refine((s) => s.startsWith("data:image/") || /^[A-Za-z0-9+/=\s]+$/.test(s), {
      message: "Expected a data:image/... URL or base64 payload",
    }),
});

router.post(
  "/handwriting-to-text",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = hwStructuredSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    if (!isHandwritingVisionConfigured()) {
      return sendJsonError(
        res,
        503,
        "Handwriting transcription is not configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or XAI_API_KEY.",
        "SERVICE_UNAVAILABLE"
      );
    }

    const structuredPrompt = `This is a doctor's handwritten prescription. Extract all medicines, dosages, instructions, and notes.
Return ONLY valid JSON (no markdown, no explanation) in this exact structure:
{
  "medicines": [
    {
      "name": "medicine name",
      "dosage": "dose e.g. 500mg",
      "frequency": "e.g. twice daily / BD / TDS",
      "duration": "e.g. 5 days",
      "instructions": "e.g. after meals"
    }
  ],
  "notes": "any additional notes or diagnosis"
}
If a field is not visible, use an empty string. Return only the JSON object.`;

    try {
      // Use vision model to extract structured data
      const ANTHROPIC_BASE = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/$/, "");
      const OPENAI_BASE = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");

      const dataUrl = parsed.data.imageBase64.startsWith("data:image/")
        ? parsed.data.imageBase64
        : `data:image/png;base64,${parsed.data.imageBase64.replace(/\s/g, "")}`;

      let rawText = "";

      if (process.env.ANTHROPIC_API_KEY?.trim()) {
        const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
        const mediaType = m ? m[1] : "image/png";
        const base64Data = m ? m[2]!.replace(/\s/g, "") : dataUrl.replace(/\s/g, "");

        const r = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY.trim(),
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_VISION_MODEL || "claude-3-5-sonnet-20241022",
            max_tokens: 2000,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
                  { type: "text", text: structuredPrompt },
                ],
              },
            ],
          }),
        });
        const raw = await r.json() as { content?: Array<{ type: string; text?: string }> };
        rawText = raw.content?.filter((c) => c.type === "text").map((c) => c.text || "").join("") || "";
      } else if (process.env.OPENAI_API_KEY?.trim()) {
        const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
            temperature: 0.1,
            max_tokens: 2000,
            messages: [
              { role: "user", content: [{ type: "text", text: structuredPrompt }, { type: "image_url", image_url: { url: dataUrl } }] },
            ],
          }),
        });
        const raw = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
        rawText = raw.choices?.[0]?.message?.content?.trim() || "";
      } else {
        // xAI fallback via plain transcription + local parse
        const { text } = await transcribeHandwritingImage(parsed.data.imageBase64);
        rawText = text;
      }

      // Parse JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const structured = JSON.parse(jsonMatch[0]);
          return res.json({ success: true, structured, rawText });
        } catch {
          // Fall through to return raw text
        }
      }

      // Fallback: return raw text with empty structure
      return res.json({
        success: true,
        structured: { medicines: [], notes: rawText },
        rawText,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Structured extraction failed";
      return sendJsonError(res, 502, msg, "BAD_GATEWAY");
    }
  })
);

// ────────────────────────────────────────────────────────────
// POST /api/ai/generate-prescription-summary
// Generate patient-facing health summary paragraph
// ────────────────────────────────────────────────────────────
const prescriptionSummarySchema = z.object({
  patientName: z.string().min(1),
  age: z.union([z.string(), z.number()]).optional(),
  diagnosis: z.string().optional(),
  medicines: z.array(z.object({
    name: z.string(),
    dosage: z.string().optional(),
    frequency: z.string().optional(),
    duration: z.string().optional(),
    instructions: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
  doctorName: z.string().min(1),
  clinicName: z.string().optional(),
});

router.post(
  "/generate-prescription-summary",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = prescriptionSummarySchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const { patientName, age, diagnosis, medicines, notes, doctorName, clinicName } = parsed.data;

    const medsText = (medicines || [])
      .map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? `, ${m.frequency}` : ""}${m.duration ? ` for ${m.duration}` : ""}`)
      .join("; ") || "as prescribed";

    const prompt = `You are a warm medical assistant writing directly to a patient. Write a brief, caring health summary paragraph (max 120 words) for ${patientName}${age ? `, age ${age}` : ""}.

Prescription details:
- Diagnosis/Complaint: ${diagnosis || "general consultation"}
- Medicines: ${medsText}
- Doctor's notes: ${notes || "follow the prescribed medicines"}

The paragraph must:
1. Start with "Dear ${patientName},"
2. Summarize their condition in simple, non-medical language
3. Briefly explain what the medicines are for
4. Give 2-3 lifestyle/care tips relevant to their condition
5. End with "Wishing you a speedy recovery. — Dr. ${doctorName}${clinicName ? `, ${clinicName}` : ""}"

Write warmly and reassuringly. Avoid medical jargon. Max 120 words. Output only the paragraph.`;

    let summary = "";

    const ANTHROPIC_BASE = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/$/, "");
    const OPENAI_BASE = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");

    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      try {
        const r = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY.trim(),
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_VISION_MODEL || "claude-3-5-sonnet-20241022",
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const raw = await r.json() as { content?: Array<{ type: string; text?: string }> };
        summary = raw.content?.filter((c) => c.type === "text").map((c) => c.text || "").join("").trim() || "";
      } catch (e) {
        console.warn("[ai] Anthropic summary failed:", e);
      }
    }

    if (!summary && process.env.OPENAI_API_KEY?.trim()) {
      try {
        const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.7,
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const raw = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
        summary = raw.choices?.[0]?.message?.content?.trim() || "";
      } catch (e) {
        console.warn("[ai] OpenAI summary failed:", e);
      }
    }

    if (!summary && isXaiConfigured()) {
      try {
        summary = await grokConsultationSummary(prompt).then((g) => g.plan || "");
      } catch (e) {
        console.warn("[ai] xAI summary failed:", e);
      }
    }

    if (!summary) {
      // Fallback: generate a simple template
      summary = `Dear ${patientName}, You have been prescribed ${medsText}. Please take your medicines regularly as directed by the doctor. Stay hydrated, get adequate rest, and follow a balanced diet. Avoid missing any doses. If symptoms worsen, please consult the doctor immediately. Wishing you a speedy recovery. — Dr. ${doctorName}${clinicName ? `, ${clinicName}` : ""}`;
    }

    return res.json({ success: true, summary });
  })
);

// ────────────────────────────────────────────────────────────
// POST /api/ai/suggest-medicines
// AI-powered medicine suggestions based on diagnosis
// ────────────────────────────────────────────────────────────
const suggestMedicinesSchema = z.object({
  diagnosis: z.string().min(1),
  patientAge: z.union([z.string(), z.number()]).optional(),
  existingMedicines: z.array(z.string()).optional(),
});

router.post(
  "/suggest-medicines",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = suggestMedicinesSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const { diagnosis, patientAge, existingMedicines } = parsed.data;
    const supabase = getSupabaseClient();

    // Always search formulary first for diagnosis-related drugs
    const safe = diagnosis.replace(/[%_]/g, "").slice(0, 80);
    const { data: formularyDrugs } = await supabase
      .from("drug_formulary")
      .select("id, name, strength, form, regulatory_notes")
      .eq("is_active", true)
      .or(`name.ilike.%${safe}%,regulatory_notes.ilike.%${safe}%`)
      .limit(10);

    // If AI is configured, get intelligent suggestions
    const ANTHROPIC_BASE = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/$/, "");

    let aiSuggestions: Array<{ name: string; dosage: string; frequency: string; duration: string; reason: string }> = [];

    const aiPrompt = `A doctor is treating a patient${patientAge ? ` aged ${patientAge}` : ""} with: "${diagnosis}".
${existingMedicines?.length ? `Already prescribed: ${existingMedicines.join(", ")}.` : ""}
Suggest 3-5 commonly prescribed medicines for this condition in India.
Return ONLY valid JSON array (no markdown):
[{"name":"medicine name","dosage":"dose","frequency":"BD/TDS/OD etc","duration":"X days","reason":"brief reason"}]`;

    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      try {
        const r = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY.trim(),
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 800,
            messages: [{ role: "user", content: aiPrompt }],
          }),
        });
        const raw = await r.json() as { content?: Array<{ type: string; text?: string }> };
        const text = raw.content?.filter((c) => c.type === "text").map((c) => c.text || "").join("").trim() || "";
        const arrMatch = text.match(/\[[\s\S]*\]/);
        if (arrMatch) aiSuggestions = JSON.parse(arrMatch[0]);
      } catch (e) {
        console.warn("[ai] Medicine suggestion failed:", e);
      }
    }

    return res.json({
      success: true,
      formularyMatches: formularyDrugs || [],
      aiSuggestions,
    });
  })
);

// ────────────────────────────────────────────────────────────
// POST /api/ai/follow-up-suggestion
// Suggest follow-up date based on diagnosis + medicines
// ────────────────────────────────────────────────────────────
const followUpSuggestionSchema = z.object({
  diagnosis: z.string().optional(),
  medicines: z.array(z.object({ name: z.string(), duration: z.string().optional() })).optional(),
  notes: z.string().optional(),
});

router.post(
  "/follow-up-suggestion",
  authMiddleware,
  requireRole("doctor", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = followUpSuggestionSchema.safeParse(req.body);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid request body", "VALIDATION_ERROR");

    const { diagnosis, medicines, notes } = parsed.data;

    const medsText = (medicines || [])
      .map((m) => `${m.name}${m.duration ? ` (${m.duration})` : ""}`)
      .join(", ");

    const prompt = `A patient was diagnosed with "${diagnosis || "general condition"}" and prescribed: ${medsText || "medicines as prescribed"}. ${notes ? `Notes: ${notes}.` : ""}
Based on the condition and medication duration, suggest an appropriate follow-up in how many days?
Return ONLY valid JSON: {"suggestedDays": <number>, "reason": "<brief reason>"}`;

    let suggestedDays = 7;
    let reason = "Standard follow-up after treatment course";

    const ANTHROPIC_BASE = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/$/, "");

    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      try {
        const r = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY.trim(),
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const raw = await r.json() as { content?: Array<{ type: string; text?: string }> };
        const text = raw.content?.filter((c) => c.type === "text").map((c) => c.text || "").join("").trim() || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed2 = JSON.parse(jsonMatch[0]);
          if (typeof parsed2.suggestedDays === "number") suggestedDays = parsed2.suggestedDays;
          if (typeof parsed2.reason === "string") reason = parsed2.reason;
        }
      } catch (e) {
        console.warn("[ai] Follow-up suggestion failed:", e);
      }
    }

    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + suggestedDays);

    return res.json({
      success: true,
      suggestedDays,
      followUpDate: followUpDate.toISOString().slice(0, 10),
      reason,
    });
  })
);

export default router;
