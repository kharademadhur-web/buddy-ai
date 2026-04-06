# Azure + Supabase deployment validation

Use this with **`pnpm verify:deployment`** (local `.env` structure) and your **Azure App Service** / **Supabase Dashboard** settings. Never commit secrets.

## Section 1 — Azure topology

| Mode | `VITE_API_URL` at **build** | `PUBLIC_URL` / CORS (runtime) |
|------|----------------------------|--------------------------------|
| **Single app** (Express serves `dist/spa` + `/api`) | **Empty** — browser uses relative `/api` ([`client/lib/api-base.ts`](../client/lib/api-base.ts)) | `https://<your-app>.azurewebsites.net` (or custom domain), HTTPS |
| **Split** (SPA elsewhere, API on App Service) | **`https://<api-host>`** (no trailing slash), rebuild client | `CORS_ORIGINS` must list **every SPA origin** |

**PASS:** Topology matches the table. **FAIL:** Same-origin deploy but `VITE_API_URL` points to another host.

---

## Section 2 — App Service environment (server)

Required by [`server/config/validate-env.ts`](../server/config/validate-env.ts):

- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`

**Production** (`NODE_ENV=production`, `CORS_ALLOW_LOCALHOST` not `true`):

- `PUBLIC_URL` **required**, must start with **`https://`**
- At least one production origin: `CORS_ORIGINS` and/or `ADMIN_URL` / `STAFF_PORTAL_URL` / `MOBILE_APP_URL` / `PUBLIC_URL`
- If `CORS_ORIGINS` is set, at least one entry must be **`https://...`**

Binding: [`server/node-build.ts`](../server/node-build.ts) uses `PORT || WEBSITES_PORT || 8080`, `HOST` default `0.0.0.0`.

Optional: `FORCE_HTTPS_REDIRECT=true` ([`server/index.ts`](../server/index.ts)).

**Never** put `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `JWT_*`, `ENCRYPTION_KEY` in `VITE_*` variables.

---

## Section 3 — Supabase

- **Server:** service role + JWT secret + project URL — see validate-env.
- **Browser bundle:** only `VITE_SUPABASE_URL` + **`VITE_SUPABASE_ANON_KEY`**.
- **Dashboard:** Authentication → URL configuration — Site URL and Redirect URLs = production HTTPS app (see also `pnpm verify:supabase`).

Startup: [`server/config/supabase-health.ts`](../server/config/supabase-health.ts) must succeed (see Log Stream: `[supabase]`).

---

## Section 4 — Storage

- Private buckets for sensitive documents; signed URLs — [`server/services/supabase-storage.service.ts`](../server/services/supabase-storage.service.ts), upload routes under [`server/routes/uploads.ts`](../server/routes/uploads.ts).
- Confirm bucket **Public** = off in Supabase Storage for sensitive buckets.

---

## Section 5 — Build

- **`pnpm build`** — produces `dist/spa` + `dist/server`.
- Same-origin: **`VITE_API_URL` empty** in env used at build time.
- Client: no hardcoded `localhost` in `client/` API calls (uses `apiUrl`).

---

## Section 6 — Startup logs (Azure Log Stream)

Expect:

- `[startup]` — NODE_ENV, bind
- `[cors]` — numbered origins (production)
- `[supabase]` — health check passed

Smoke: `GET /health`, `GET /api/ping` on your HTTPS base URL.

---

## Section 7 — Debugging issues

Provide: HTTP status, path, browser **Origin** (if CORS), one log line — no secrets.

| Symptom | Check |
|--------|--------|
| CORS | Origin in `CORS_ORIGINS` / `PUBLIC_URL` list; HTTPS redirect not breaking `OPTIONS` |
| Login | `/api/auth/*` response body; JWT middleware |
| 500 | Server log stack; `error.code` in JSON body |

---

## Section 8 — Security

- CORS restricted in production; localhost stripped unless `CORS_ALLOW_LOCALHOST=true`.
- `trust proxy` + optional HTTPS redirect when enabled.
- RBAC: [`server/middleware/rbac.middleware.ts`](../server/middleware/rbac.middleware.ts).

---

## Section 9 — Final sign-off

Say **only** when all are true:

1. Topology matches `VITE_API_URL` choice.
2. Azure env passes validation (and live app starts).
3. Supabase Auth URLs + anon vs service separation correct.
4. Logs show `[startup]`, `[cors]`, `[supabase]`; `/health` and `/api/ping` OK on HTTPS.
5. Happy-path login + one API call succeeded on **production** URL.

**"DEPLOYMENT CONFIG VERIFIED — READY FOR LIVE USERS"**
