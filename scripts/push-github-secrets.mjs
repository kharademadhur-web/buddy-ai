/**
 * Pushes required GitHub Actions **repository secrets** from a local file (not committed).
 *
 * Prerequisite: GitHub CLI — https://cli.github.com/
 *   winget install GitHub.cli
 *   gh auth login
 *
 * 1. Copy scripts/github-actions-secrets.example.env → scripts/github-actions-secrets.local.env
 * 2. Fill VITE_* and save Azure publish profile as publish-profile.xml in repo root (or set PUBLISH_PROFILE_PATH)
 * 3. From repo root: node scripts/push-github-secrets.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, "scripts/github-actions-secrets.local.env");

function runGhSecretSet(name, body) {
  execSync(`gh secret set "${name}"`, {
    input: body,
    stdio: ["pipe", "inherit", "inherit"],
    cwd: root,
    env: { ...process.env },
  });
}

try {
  execSync("gh auth status", { stdio: "pipe", cwd: root });
} catch {
  console.error("GitHub CLI not logged in. Run: gh auth login");
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error("Missing:", envPath);
  console.error("Copy scripts/github-actions-secrets.example.env → scripts/github-actions-secrets.local.env and fill it.");
  process.exit(1);
}

const text = readFileSync(envPath, "utf8");
/** @type {Record<string, string>} */
const vars = {};
for (const line of text.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  vars[k] = v;
}

const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
for (const k of required) {
  if (!vars[k]?.trim()) {
    console.error(`Set ${k} in scripts/github-actions-secrets.local.env`);
    process.exit(1);
  }
}

const profileRel = vars.PUBLISH_PROFILE_PATH?.trim() || "publish-profile.xml";
const profilePath = resolve(root, profileRel);
if (!existsSync(profilePath)) {
  console.error("Publish profile not found:", profilePath);
  console.error("Azure Portal → App Service → Get publish profile → save as that file.");
  process.exit(1);
}

console.log("Setting VITE_SUPABASE_URL …");
runGhSecretSet("VITE_SUPABASE_URL", vars.VITE_SUPABASE_URL);

console.log("Setting VITE_SUPABASE_ANON_KEY …");
runGhSecretSet("VITE_SUPABASE_ANON_KEY", vars.VITE_SUPABASE_ANON_KEY);

const xml = readFileSync(profilePath, "utf8");
console.log("Setting AZURE_WEBAPP_PUBLISH_PROFILE …");
runGhSecretSet("AZURE_WEBAPP_PUBLISH_PROFILE", xml);

console.log("\nDone. Secrets are on this repo. Actions → re-run failed workflow.");
