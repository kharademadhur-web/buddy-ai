/**
 * Quick check: OPENAI_API_KEY, ANTHROPIC_API_KEY, and/or XAI (GROK) keys reach provider APIs.
 * Loads .env from project root. Does not print secrets.
 *
 * Usage: node scripts/check-vision-api-keys.mjs
 */
import "dotenv/config";

const OPENAI_BASE = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
const XAI_BASE = (process.env.XAI_API_BASE || "https://api.x.ai/v1").replace(/\/$/, "");
const ANTHROPIC_BASE = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/$/, "");

async function main() {
  const openai = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const xai = (process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim();

  if (openai) {
    const r = await fetch(`${OPENAI_BASE}/models?limit=1`, {
      headers: { Authorization: `Bearer ${openai}` },
    });
    console.log(
      "OPENAI_API_KEY:",
      r.ok ? "working (key accepted — /v1/models returned OK)" : `not working (HTTP ${r.status} from /v1/models)`
    );
  } else {
    console.log("OPENAI_API_KEY: not set in environment / .env");
  }

  if (anthropic) {
    const model = (process.env.ANTHROPIC_VISION_MODEL || "claude-3-5-haiku-20241022").trim();
    const r = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": anthropic,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with exactly the two letters OK and nothing else." }],
      }),
    });
    let detail = "";
    try {
      const j = await r.json();
      if (!r.ok && j?.error?.message) detail = ` — ${j.error.message}`;
    } catch {
      /* ignore */
    }
    console.log(
      "ANTHROPIC_API_KEY:",
      r.ok ? "working (Messages API accepted the key)" : `not working (HTTP ${r.status})${detail}`
    );
  } else {
    console.log("ANTHROPIC_API_KEY: not set in environment / .env");
  }

  if (xai) {
    const model = (process.env.XAI_MODEL || "grok-2-latest").trim();
    const r = await fetch(`${XAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xai}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with the word OK only." }],
      }),
    });
    let detail = "";
    try {
      const j = await r.json();
      if (!r.ok && j?.error?.message) detail = ` — ${j.error.message}`;
    } catch {
      /* ignore */
    }
    console.log(
      "XAI_API_KEY / GROK_API_KEY:",
      r.ok ? "working (chat completion request succeeded)" : `not working (HTTP ${r.status})${detail}`
    );
  } else {
    console.log("XAI_API_KEY / GROK_API_KEY: not set in environment / .env");
  }

  if (!openai && !anthropic && !xai) {
    console.log("\nSet at least one key in .env (local) or Azure App Settings (production), then run again.");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Check failed (network or script error):", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
