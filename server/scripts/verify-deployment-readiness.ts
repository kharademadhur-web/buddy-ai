#!/usr/bin/env npx tsx
/**
 * Offline / local check: same rules as server startup env validation (no secrets printed).
 * Load .env from project root: run from repo root with `pnpm verify:deployment`.
 *
 * Does NOT call Supabase (use live smoke / Azure Log Stream for [supabase] health).
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { collectEnvironmentValidationIssues } from "../config/validate-env";

const root = join(import.meta.dirname, "../..");
const envPath = join(root, ".env");

function checkViteApiUrlForTopology(): { ok: boolean; messages: string[] } {
  const messages: string[] = [];
  if (!existsSync(envPath)) {
    messages.push("No .env file — set VITE_API_URL at build time in CI or Azure build pipeline.");
    return { ok: true, messages };
  }
  const raw = readFileSync(envPath, "utf8");
  const line = raw
    .split("\n")
    .find((l) => /^\s*VITE_API_URL\s*=/.test(l));
  if (!line) {
    messages.push("VITE_API_URL not in .env — same-origin default is OK if API+SPA share one host.");
    return { ok: true, messages };
  }
  const val = line.replace(/^\s*VITE_API_URL\s*=\s*/, "").trim();
  const empty = val === "" || val === '""' || val === "''";
  if (empty) {
    messages.push("VITE_API_URL is empty → same-origin (/api) — PASS for single App Service deploy.");
  } else if (!val.startsWith("https://")) {
    messages.push("FAIL: VITE_API_URL should be https://... for production (split deploy) or empty (same-origin).");
    return { ok: false, messages };
  } else {
    messages.push(
      "VITE_API_URL is set to an absolute URL → split deploy; ensure CORS_ORIGINS includes your SPA origin."
    );
  }
  return { ok: true, messages };
}

function checkNoDangerousViteSecrets(): { ok: boolean; messages: string[] } {
  const messages: string[] = [];
  if (!existsSync(envPath)) return { ok: true, messages };
  const raw = readFileSync(envPath, "utf8");
  const bad = [
    "VITE_SUPABASE_SERVICE",
    "VITE_.*SERVICE_ROLE",
    "SUPABASE_SERVICE_KEY",
  ];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (t.startsWith("#") || !t) continue;
    if (/VITE_.*SERVICE|SERVICE_ROLE/i.test(t) && /VITE_/.test(t)) {
      messages.push(
        "SECURITY: Do not prefix service role keys with VITE_ — they would ship in the browser bundle."
      );
      return { ok: false, messages };
    }
  }
  return { ok: true, messages };
}

console.log("=== Deployment readiness (env structure) ===\n");

const issues = collectEnvironmentValidationIssues();
let failed = false;

if (issues.productionCorsFatal) {
  console.log("FAIL: Production CORS — no valid http(s) origin (see validate-env rules).");
  failed = true;
}

if (issues.missing.length > 0) {
  console.log("FAIL: Missing required variables:");
  issues.missing.forEach((m) => console.log(`  - ${m}`));
  failed = true;
} else {
  console.log("PASS: No missing required keys (for current NODE_ENV and rules).");
}

if (issues.unsafe.length > 0) {
  console.log("FAIL: Unsafe / placeholder values:");
  issues.unsafe.forEach((u) => console.log(`  - ${u}`));
  failed = true;
} else if (!failed) {
  console.log("PASS: No placeholder-flagged values.");
}

const port = process.env.PORT || process.env.WEBSITES_PORT || "8080";
const host = process.env.HOST || "0.0.0.0";
console.log(`\nBinding (code): HOST default ${host}, PORT from PORT||WEBSITES_PORT||8080 → effective ${port} (set in Azure).`);

const vite = checkViteApiUrlForTopology();
vite.messages.forEach((m) => console.log(`\n[VITE_API_URL / build] ${m}`));
if (!vite.ok) failed = true;

const sec = checkNoDangerousViteSecrets();
sec.messages.forEach((m) => console.log(`\n[security] ${m}`));
if (!sec.ok) failed = true;

console.log(`
Manual (not automated):
  - Supabase Dashboard: Auth URL + Redirect URLs = production HTTPS origin
  - Storage: private buckets for sensitive docs; signed URLs (see server/services/supabase-storage.service.ts)
  - After deploy: Log Stream should show [startup], [cors], [supabase]; curl /health and /api/ping
  - Full checklist: docs/azure-deployment-validation.md
`);

process.exit(failed ? 1 : 0);
