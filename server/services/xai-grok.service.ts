/**
 * xAI Grok — OpenAI-compatible chat completions.
 * https://docs.x.ai/docs/api-reference#chat-completions
 *
 * Set XAI_API_KEY (or GROK_API_KEY) on the server. Optional: XAI_MODEL (default grok-2-latest).
 */

const XAI_BASE = (process.env.XAI_API_BASE || "https://api.x.ai/v1").replace(/\/$/, "");

export function isXaiConfigured(): boolean {
  return Boolean((process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim());
}

export async function grokChatCompletion(params: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const key = (process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim();
  if (!key) {
    throw new Error("XAI_API_KEY or GROK_API_KEY is not configured");
  }

  const model = (process.env.XAI_MODEL || "grok-2-latest").trim();

  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: params.temperature ?? 0.25,
      max_tokens: params.maxTokens ?? 1200,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });

  const raw = (await res.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!res.ok) {
    throw new Error(raw.error?.message || `xAI HTTP ${res.status}`);
  }

  const text = raw.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty response from Grok");
  }
  return text;
}

/** Consent-gated clinical summary from transcript / notes. */
export async function grokConsultationSummary(transcript: string): Promise<{
  chiefComplaint: string;
  history: string;
  plan: string;
}> {
  const system = `You are a clinical documentation assistant. Output valid JSON only, no markdown.
The JSON shape must be exactly:
{"chiefComplaint":"string","history":"string","plan":"string"}
- chiefComplaint: one short sentence
- history: relevant history and exam (max ~600 chars)
- plan: assessment / plan bullets (max ~500 chars)
Never diagnose definitively; this is draft documentation for a licensed clinician to review.`;

  const text = await grokChatCompletion({
    system,
    user: `Clinical notes / transcript:\n\n${transcript.slice(0, 12000)}`,
    temperature: 0.2,
    maxTokens: 900,
  });

  try {
    const parsed = JSON.parse(text) as { chiefComplaint?: string; history?: string; plan?: string };
    return {
      chiefComplaint: parsed.chiefComplaint || text.slice(0, 200),
      history: parsed.history || transcript.slice(0, 800),
      plan: parsed.plan || "Review clinically.",
    };
  } catch {
    return {
      chiefComplaint: transcript.slice(0, 160),
      history: transcript.slice(0, 800),
      plan: text.slice(0, 600),
    };
  }
}
