import "dotenv/config";
import express from "express";
import cors from "cors";

// Import middleware
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error-handler.middleware";
import { requestLogger } from "./middleware/request-logger.middleware";

// Import routes
import { handleDemo } from "./routes/demo";
import authSupabaseRoutes from "./routes/auth-supabase";
import clinicsAdminRoutes from "./routes/clinics-admin";
import usersAdminRoutes from "./routes/users-admin";
import analyticsAdminRoutes from "./routes/analytics-admin";
import kycAdminRoutes from "./routes/kyc-admin";
import appointmentsRoutes from "./routes/appointments";
import queueV2Routes from "./routes/queue-v2";
import consultationsV2Routes from "./routes/consultations-v2";
import billingV2Routes from "./routes/billing-v2";
import realtimeRoutes from "./routes/realtime";
import uploadsRoutes from "./routes/uploads";
import patientsV2Routes from "./routes/patients-v2";
import staffRoutes from "./routes/staff";
import aiClinicalRoutes from "./routes/ai-clinical";
import messagingWhatsappRoutes from "./routes/messaging-whatsapp";

function isLocalhostOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]" ||
      u.hostname === "::1"
    );
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

export async function createServer() {
  const app = express();

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
    if (!process.env.CORS_ORIGINS && !process.env.ADMIN_URL && !process.env.STAFF_PORTAL_URL) {
      console.warn(
        "[config] Production CORS: set CORS_ORIGINS and/or ADMIN_URL, STAFF_PORTAL_URL to your HTTPS domains."
      );
    }
  }

  const allowLocalhostCors =
    process.env.NODE_ENV !== "production" || process.env.CORS_ALLOW_LOCALHOST === "true";

  const defaultCorsOrigins = [
    ...(allowLocalhostCors ? (["http://localhost:3000", "http://localhost:8080"] as const) : []),
    process.env.ADMIN_URL,
    process.env.MOBILE_APP_URL,
    process.env.STAFF_PORTAL_URL,
    process.env.PUBLIC_URL,
  ].filter(Boolean) as string[];
  const extraCors =
    process.env.CORS_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  let corsOrigins = [...new Set([...defaultCorsOrigins, ...extraCors])];

  if (process.env.NODE_ENV === "production" && !allowLocalhostCors) {
    const before = corsOrigins.length;
    corsOrigins = corsOrigins.filter((o) => !isLocalhostOrigin(o));
    if (before !== corsOrigins.length) {
      console.warn("[cors] Removed localhost origins from allowlist (production + CORS_ALLOW_LOCALHOST≠true)");
    }
  }

  if (process.env.NODE_ENV === "production") {
    console.log(
      `[cors] mode=production allowLocalhost=${allowLocalhostCors} count=${corsOrigins.length}`
    );
    corsOrigins.forEach((o, i) => console.log(`[cors]   ${i + 1}. ${o}`));
  }

  const allowedOriginSet = new Set(corsOrigins);
  const corsOriginFn = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // React Native / native fetch often omits Origin; curl and server-side calls too.
    if (!origin) return callback(null, true);
    if (allowedOriginSet.has(origin)) return callback(null, true);
    if (process.env.NODE_ENV === "production") {
      console.warn(`[cors] blocked origin=${origin}`);
    }
    callback(null, false);
  };

  // HTTPS redirect before CORS so clients upgrade once, then preflight hits HTTPS (avoids redirect loops).
  if (process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS_REDIRECT === "true") {
    app.use((req, res, next) => {
      if (req.method === "OPTIONS") return next();
      if (req.secure) return next();
      const xf = req.get("x-forwarded-proto");
      if (xf === "https") return next();
      if (xf === "http") {
        const host = req.get("host") || "";
        return res.redirect(301, `https://${host}${req.originalUrl}`);
      }
      next();
    });
  }

  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOriginFn : true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  // Ping endpoint
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong";
    res.json({ message: ping });
  });

  // Demo endpoint
  app.get("/api/demo", handleDemo);

  // =====================
  // Authentication Routes
  // =====================
  app.use("/api/auth", authSupabaseRoutes);

  // =====================
  // Admin Routes (Super Admin)
  // =====================

  // Clinic management
  app.use("/api/admin/clinics", clinicsAdminRoutes);

  // User management (doctors, receptionists)
  app.use("/api/admin/users", usersAdminRoutes);

  // KYC uploads & signed URLs
  app.use("/api/admin/kyc", kycAdminRoutes);

  // Analytics & Reporting
  app.use("/api/admin/analytics", analyticsAdminRoutes);

  // =====================
  // Clinic App Routes (Doctor/Receptionist/Independent)
  // =====================

  app.use("/api/appointments", appointmentsRoutes);
  app.use("/api/queue", queueV2Routes);
  app.use("/api/consultations", consultationsV2Routes);
  app.use("/api/billing", billingV2Routes);
  app.use("/api/realtime", realtimeRoutes);
  app.use("/api/uploads", uploadsRoutes);
  app.use("/api/patients", patientsV2Routes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/ai", aiClinicalRoutes);
  app.use("/api/messaging", messagingWhatsappRoutes);

  // =====================
  // Device Approval Routes
  // =====================
  app.use(
    "/api/admin/device-approval",
    (await import("./routes/device-approval")).default
  );

  return app;
}

/**
 * Register 404 + error handler — call **after** static / SPA middleware in production (`node-build.ts`).
 * In dev (`server-dev.ts`), call immediately after `createServer()`.
 */
export function registerAppErrorHandlers(app: import("express").Application): void {
  app.use(notFoundHandler);
  app.use(errorHandler);
}
