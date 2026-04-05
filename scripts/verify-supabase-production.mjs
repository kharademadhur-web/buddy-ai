#!/usr/bin/env node
/**
 * Prints a production checklist for Supabase + migrations.
 * Does not connect to Supabase or read secrets.
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

let files = [];
try {
  files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
} catch {
  console.error("Could not read supabase/migrations");
  process.exit(1);
}

console.log("=== Supabase production checklist ===\n");
console.log(`Migrations in repo (${files.length} files) — apply the same set to your live project:\n`);
files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
console.log(`
Manual steps (Supabase Dashboard):
  1. SQL Editor or CLI: run any migration not yet applied, in filename order.
  2. Authentication → URL configuration:
     - Site URL = your production app origin (e.g. https://admin.example.com)
     - Redirect URLs = that origin and paths your app uses after login
  3. Settings → API: confirm project URL matches VITE_SUPABASE_URL / SUPABASE_URL on Azure.

Compare JWT Secret in dashboard with App Service setting SUPABASE_JWT_SECRET (do not paste secrets here).
`);
