#!/usr/bin/env node
/**
 * HTTP smoke test for a deployed app. No secrets.
 * Usage: LIVE_URL=https://your-host pnpm smoke:live
 */
const base = (process.env.LIVE_URL || process.env.PUBLIC_URL || "").replace(/\/$/, "");
if (!base || !base.startsWith("http")) {
  console.error(
    "Set LIVE_URL or PUBLIC_URL to your production base URL (e.g. https://admin.example.com)"
  );
  process.exit(1);
}

const paths = ["/health", "/api/ping"];

async function check(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  let body = text;
  if (body.length > 200) body = body.slice(0, 200) + "…";
  return { path, url, ok: res.ok, status: res.status, body };
}

let failed = false;
for (const path of paths) {
  try {
    const r = await check(path);
    if (r.ok) {
      console.log(`OK ${r.status} ${r.path} → ${r.body}`);
    } else {
      console.error(`FAIL ${r.status} ${r.path} → ${r.body}`);
      failed = true;
    }
  } catch (e) {
    console.error(`FAIL ${path}:`, e.message || e);
    failed = true;
  }
}

if (failed) {
  console.error("\nFix deployment or URL, then re-run.");
  process.exit(1);
}

console.log("\nNext: browser login as admin → onboard clinic → receptionist → doctor (manual).");
