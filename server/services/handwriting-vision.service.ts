/**
 * Handwriting → text via vision models (server-side only; keys stay on the server).
 * Priority: OpenAI → Anthropic → xAI (first configured provider that succeeds).
 */

import { grokHandwritingTranscribe, isXaiConfigured } from "./xai-grok.service";

const OPENAI_BASE = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
const ANTHROPIC_BASE = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/$/, "");

function normalizeImageDataUrl(input: string): string {
  const t = input.trim();
  if (t.startsWith("data:image/")) return t;
  const b64 = t.replace(/\s/g, "");
  return `data:image/png;base64,${b64}`;
}

/** Split data URL into parts for Anthropic image block. */
function parseDataUrlForAnthropic(dataUrl: string): { mediaType: string; base64: string } {
  const t = dataUrl.trim();
  const m = /^data:([^;]+);base64,(.+)$/s.exec(t);
  if (m) {
    return { mediaType: m[1], base64: m[2]!.replace(/\s/g, "") };
  }
  return { mediaType: "image/png", base64: t.replace(/\s/g, "") };
}

function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

async function openAiHandwritingTranscribe(dataUrl: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY!.trim();
  const model = (process.env.OPENAI_VISION_MODEL || "gpt-4o-mini").trim();

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1600,
      messages: [
        {
          role: "system",
          content:
            "You transcribe clinical handwriting from prescription pads. Output plain text only: transcribed content, preserving line breaks. Do not add explanations. If something is illegible, write [illegible].",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe all visible handwriting in this image." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  const raw = (await res.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!res.ok) {
    throw new Error(raw.error?.message || `OpenAI HTTP ${res.status}`);
  }

  const text = raw.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty transcription from OpenAI");
  return text;
}

async function anthropicHandwritingTranscribe(dataUrl: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY!.trim();
  const model = (process.env.ANTHROPIC_VISION_MODEL || "claude-3-5-sonnet-20241022").trim();
  const { mediaType, base64 } = parseDataUrlForAnthropic(dataUrl);

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      system:
        "You transcribe clinical handwriting from prescription pads. Output plain text only: transcribed content, preserving line breaks. Do not add explanations. If something is illegible, write [illegible].",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: "Transcribe all visible handwriting in this image." },
          ],
        },
      ],
    }),
  });

  const raw = (await res.json()) as {
    error?: { message?: string; type?: string };
    content?: Array<{ type: string; text?: string }>;
  };

  if (!res.ok) {
    throw new Error(raw.error?.message || `Anthropic HTTP ${res.status}`);
  }

  const text =
    raw.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("")
      .trim() || "";
  if (!text) throw new Error("Empty transcription from Anthropic");
  return text;
}

export function isHandwritingVisionConfigured(): boolean {
  return isOpenAiConfigured() || isAnthropicConfigured() || isXaiConfigured();
}

export async function transcribeHandwritingImage(imageBase64OrDataUrl: string): Promise<{
  text: string;
  provider: "openai" | "anthropic" | "xai";
}> {
  const dataUrl = normalizeImageDataUrl(imageBase64OrDataUrl);

  if (isOpenAiConfigured()) {
    try {
      const text = await openAiHandwritingTranscribe(dataUrl);
      return { text, provider: "openai" };
    } catch (e) {
      console.warn("[handwriting-vision] OpenAI failed:", e);
      if (!isAnthropicConfigured() && !isXaiConfigured()) throw e;
    }
  }

  if (isAnthropicConfigured()) {
    try {
      const text = await anthropicHandwritingTranscribe(dataUrl);
      return { text, provider: "anthropic" };
    } catch (e) {
      console.warn("[handwriting-vision] Anthropic failed:", e);
      if (!isXaiConfigured()) throw e;
    }
  }

  if (isXaiConfigured()) {
    const text = await grokHandwritingTranscribe(dataUrl);
    return { text, provider: "xai" };
  }

  throw new Error(
    "No vision provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or XAI_API_KEY / GROK_API_KEY (see .env.example)."
  );
}
