# Fusion Starter

A production-ready full-stack React application template with integrated Express server, featuring React Router 6 SPA mode, TypeScript, Vitest, Zod and modern tooling.

While the starter comes with a express server, only create endpoint when strictly neccesary, for example to encapsulate logic that must leave in the server, such as private keys handling, or certain DB operations, db...

## Tech Stack

- **PNPM**: Prefer pnpm
- **Frontend**: React 18 + React Router 6 (spa) + TypeScript + Vite + TailwindCSS 3
- **Backend**: Express server integrated with Vite dev server
- **Testing**: Vitest
- **UI**: Radix UI + TailwindCSS 3 + Lucide React icons

## Project Structure

```
client/                   # React SPA frontend
├── pages/                # Route components (Index.tsx = home)
├── components/ui/        # Pre-built UI component library
├── App.tsx                # App entry point and with SPA routing setup
└── global.css            # TailwindCSS 3 theming and global styles

server/                   # Express API backend
├── index.ts              # Main server setup (express config + routes)
└── routes/               # API handlers

shared/                   # Types used by both client & server
└── api.ts                # Example of how to share api interfaces
```

## Key Features

## SPA Routing System

The routing system is powered by React Router 6:

- `client/pages/Index.tsx` represents the home page.
- Routes are defined in `client/App.tsx` using the `react-router-dom` import
- Route files are located in the `client/pages/` directory

For example, routes can be defined with:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";

<Routes>
  <Route path="/" element={<Index />} />
  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
  <Route path="*" element={<NotFound />} />
</Routes>;
```

### Styling System

- **Primary**: TailwindCSS 3 utility classes
- **Theme and design tokens**: Configure in `client/global.css` 
- **UI components**: Pre-built library in `client/components/ui/`
- **Utility**: `cn()` function combines `clsx` + `tailwind-merge` for conditional classes

```typescript
// cn utility usage
className={cn(
  "base-classes",
  { "conditional-class": condition },
  props.className  // User overrides
)}
```

### Express Server Integration

- **Development**: Single port (8080) for both frontend/backend
- **Hot reload**: Both client and server code
- **API endpoints**: Prefixed with `/api/`

#### Example API Routes
- `GET /api/ping` - Simple ping api
- `GET /api/demo` - Demo endpoint  

### Shared Types
Import consistent types in both client and server:
```typescript
import { DemoResponse } from '@shared/api';
```

Path aliases:
- `@shared/*` - Shared folder
- `@/*` - Client folder

## Development Commands

```bash
pnpm dev        # Start dev server (client + server)
pnpm build      # Production build
pnpm start      # Start production server
pnpm typecheck  # TypeScript validation
pnpm test          # Run Vitest tests
```

## Adding Features

### Add new colors to the theme

Open `client/global.css` and `tailwind.config.ts` and add new tailwind colors.

### New API Route
1. **Optional**: Create a shared interface in `shared/api.ts`:
```typescript
export interface MyRouteResponse {
  message: string;
  // Add other response properties here
}
```

2. Create a new route handler in `server/routes/my-route.ts`:
```typescript
import { RequestHandler } from "express";
import { MyRouteResponse } from "@shared/api"; // Optional: for type safety

export const handleMyRoute: RequestHandler = (req, res) => {
  const response: MyRouteResponse = {
    message: 'Hello from my endpoint!'
  };
  res.json(response);
};
```

3. Register the route in `server/index.ts`:
```typescript
import { handleMyRoute } from "./routes/my-route";

// Add to the createServer function:
app.get("/api/my-endpoint", handleMyRoute);
```

4. Use in React components with type safety:
```typescript
import { MyRouteResponse } from '@shared/api'; // Optional: for type safety

const response = await fetch('/api/my-endpoint');
const data: MyRouteResponse = await response.json();
```

### New Page Route
1. Create component in `client/pages/MyPage.tsx`
2. Add route in `client/App.tsx`:
```typescript
<Route path="/my-page" element={<MyPage />} />
```

## Production Deployment

- **Standard**: `pnpm build`
- **Binary**: Self-contained executables (Linux, macOS, Windows)
- **Cloud Deployment**: Use either Netlify or Vercel via their MCP integrations for easy deployment. Both providers work well with this starter template.

### Azure App Service (auto-deploy from GitHub)

Pushing this repo to GitHub triggers [.github/workflows/azure-webapp.yml](.github/workflows/azure-webapp.yml) on **`main`** or **`master`**: it builds on **Ubuntu** (Linux `node_modules`, required for native deps like `bcrypt`), then deploys to the configured Web App.

**One-time setup (GitHub → Settings → Secrets and variables):**

| Secret | Description |
|--------|-------------|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Azure Portal → your App Service → **Get publish profile** (paste entire `.PublishSettings` XML) |
| `VITE_SUPABASE_URL` | Supabase project URL (baked into client at build time) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client build only) |

**Optional variables:** `AZURE_WEBAPP_NAME` (default `buddyai-app`), `VITE_API_URL` (omit for same-origin `/api`).

**Azure App Service:** Startup command `node dist/server/node-build.mjs`; set **`SCM_DO_BUILD_DURING_DEPLOYMENT=false`** so Kudu/Oryx does not overwrite GitHub deploys. Configure production env vars (`PUBLIC_URL`, `CORS_ORIGINS`, `SUPABASE_*`, `JWT_*`, etc.) in **Configuration** as documented in `server/config/validate-env.ts`.

**After each push:** run `LIVE_URL=https://your-domain pnpm smoke:live` and `pnpm verify:supabase` for a quick checklist.

**Manual deploy (no GitHub):** `pnpm build`, then deploy a Linux-built artifact (e.g. `deploy/` with `dist/`, `package.json`, and `npm install --omit=dev` run on Linux or on the App Service) — do not zip Windows `node_modules` for Linux App Service.

## Clinic admin portal (how it fits together)

- **Clinic owners** use role **`clinic-admin`**, same SPA as super‑admin: **`/portal/login`** → **`/admin-dashboard/*`**. APIs scope data to **`req.user.clinicId`**.
- **Staff** (doctor / reception) → **`/portal/login`** → **`/doctor-dashboard`** or **`/reception-dashboard`**.
- **Subscription** money is recorded via **Razorpay** (Billing page + webhook) or **super‑admin** manual **`POST /api/admin/clinics/:id/saas-payment`** (shared service). Env: **`RAZORPAY_KEY_ID`**, **`RAZORPAY_KEY_SECRET`**, webhook URL **`POST /api/admin/billing-saas/webhook`**.
- **Reminders** (optional): `pnpm subscription:reminders` on a schedule; needs WhatsApp/Twilio/Meta env and `PUBLIC_URL`/`ADMIN_URL` for links.

### Manual test checklist (QA)

1. **Super‑admin**: Login → Overview (platform KPIs) → **Clinics** → open a clinic → **Clinic detail** (letterhead, staff, record SaaS payment if needed).
2. **Clinic‑admin**: Login → Overview (clinic‑scoped cards) → **My clinic** → **Billing** (plan, history, Pay with Razorpay if keys set) → **Users** (staff) → **Device approvals** (own clinic only).
3. **Sidebar**: Clinic‑admin must **not** see KYC, global onboarding, or platform‑only items.
4. **Doctor / reception**: Login → **Portal** dashboards; queue/patients load when clinic subscription is **live** and not expired.

### Demo credentials (local / staging only)

The repo **does not** ship real passwords. Real accounts live in **Supabase `public.users`** (`user_id` + bcrypt `password_hash`).

**Optional demo super‑admin** (run once in **Supabase → SQL Editor**):

- Script: [`scripts/seed-demo-super-admin.sql`](scripts/seed-demo-super-admin.sql)

| Field | Value |
|--------|--------|
| **User ID** | `DEMO-SA-1` |
| **Password** | `SmartClinic-Test-2026!` |

Use **`/portal/login`** or **`/admin/login`**, enter the **User ID** (not email) and password.

Then use the **Admin UI** (Users / Onboarding) to create a **clinic** and a **`clinic-admin`** user with a password you choose — that is how you test the **clinic owner** portal end‑to‑end.

**Do not** commit the seed script output to production without rotating the password or deleting the demo user.

## Architecture Notes

- Single-port development with Vite + Express integration
- TypeScript throughout (client, server, shared)
- Full hot reload for rapid development
- Production-ready with multiple deployment options
- Comprehensive UI component library included
- Type-safe API communication via shared interfaces
