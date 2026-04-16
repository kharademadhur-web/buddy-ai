/**
 * Handwriting → text via vision models (server-side only; keys stay on server).
 * Priority: OpenAI (gpt-4o-mini) if OPENAI_API_KEY is set, else xAI if XAI_API_KEY / GROK_API_KEY + vision model.
 */

import { grokHandwritingTranscribe, isXaiConfigured } from "./xai-grok.service";

const OPENAI_BASE = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");

function normalizeImageDataUrl(input: string): string {
  const t = input.trim();
  if (t.startsWith("data:image/")) return t;
  const b64 = t.replace(/\s/g, "");
  return `data:image/png;base64,${b64}`;
}

function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
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

export function isHandwritingVisionConfigured(): boolean {
  return isOpenAiConfigured() || isXaiConfigured();
}

export async function transcribeHandwritingImage(imageBase64OrDataUrl: string): Promise<{
  text: string;
  provider: "openai" | "xai";
}> {
  const dataUrl = normalizeImageDataUrl(imageBase64OrDataUrl);

  if (isOpenAiConfigured()) {
    try {
      const text = await openAiHandwritingTranscribe(dataUrl);
      return { text, provider: "openai" };
    } catch (e) {
      console.warn("[handwriting-vision] OpenAI failed:", e);
      if (!isXaiConfigured()) throw e;
    }
  }

  if (isXaiConfigured()) {
    const text = await grokHandwritingTranscribe(dataUrl);
    return { text, provider: "xai" };
  }

  throw new Error(
    "No vision provider configured. Set OPENAI_API_KEY (recommended, uses gpt-4o-mini) or XAI_API_KEY with a vision-capable model (see XAI_VISION_MODEL)."
  );
}
