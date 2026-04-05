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

/** SPA shell: GET / must be 200 HTML (HEAD / may be 404 on Express static). */
async function checkRoot() {
  const url = `${base}/`;
  const res = await fetch(url, { redirect: "follow" });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  const looksLikeSpa =
    /text\/html/i.test(ct) &&
    (/<!DOCTYPE/i.test(text) || /<html/i.test(text) || /root|vite|react/i.test(text));
  return {
    path: "/",
    url: res.url,
    ok: res.ok && looksLikeSpa,
    status: res.status,
    body: looksLikeSpa ? `text/html (${text.length} bytes)` : ct.slice(0, 80),
  };
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

if (process.env.SMOKESKIP_ROOT !== "1") {
  try {
    const r = await checkRoot();
    if (r.ok) {
      console.log(`OK ${r.status} GET ${r.path} → ${r.body} (final: ${r.url})`);
    } else {
      console.error(`FAIL ${r.status} GET ${r.path} → ${r.body}`);
      failed = true;
    }
  } catch (e) {
    console.error(`FAIL GET /:`, e.message || e);
    failed = true;
  }
}

if (failed) {
  console.error("\nFix deployment or URL, then re-run.");
  process.exit(1);
}

console.log("\nNext: browser login as admin → onboard clinic → receptionist → doctor (manual).");
