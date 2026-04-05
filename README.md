# Clinical Assistant Hub

Full-stack React (SPA) + Express API with **Supabase** as the system of record (Postgres + Storage), plus an **Android APK** build via **Capacitor**.

## What runs where

- **Your server (VPS / dedicated)**: hosts the web app + Express API (`/api/*`). Holds secrets like `SUPABASE_SERVICE_KEY`.
- **Supabase**: stores **all application data** (Postgres) and **all uploads** (Storage).
- **Android APK**: wraps the same SPA inside a native shell and talks to your server over HTTPS.

## Prerequisites

- Node.js + PNPM
- Supabase project (managed cloud recommended)
- Android Studio (for building/running the APK)

## Environment variables

Copy `.env.example` to `.env` and fill:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY` (server-only)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `ADMIN_URL`, `MOBILE_APP_URL`

## Local development

```bash
pnpm dev
```

- SPA: `http://localhost:8080`
- API: proxied to Express at `http://localhost:3000` (via Vite)

## Database migrations (Supabase)

SQL migrations live in `supabase/migrations/`.

- `001_create_clinic_tables.sql`
- `002_create_otp_sessions.sql`
- `003_create_documents.sql` (upload metadata)

Apply them in the Supabase SQL editor or via Supabase CLI (if you use it).

## Uploads (Supabase Storage)

- App endpoint: `POST /api/uploads/report` uploads a file to the private `reports` bucket and stores metadata in the `documents` table.
- Access: the API returns a signed URL for temporary access.

## Android APK (Capacitor)

One-time Android platform setup was added under `android/`.

Sync latest web build into the Android project:

```bash
pnpm cap:sync
```

Open Android Studio:

```bash
pnpm android:open
```

Build an APK/AAB from Android Studio (recommended) or using Gradle tasks.

## Production deployment (your server)

1) Put the app behind HTTPS (reverse proxy). Example: Nginx / Caddy / IIS reverse proxy.
2) Set the `.env` on the server (do not commit secrets).
3) Build and start:

```bash
pnpm install
pnpm build
pnpm start
```

### Notes

- The Android app **must** call your server using **HTTPS** in production.
- Keep `SUPABASE_SERVICE_KEY` **only on the server** (never inside the Android app or browser bundle).

