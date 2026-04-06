import path from "path";
import { createServer, registerAppErrorHandlers } from "./index";
import express from "express";
import { validateEnvironmentVariables } from "./config/validate-env";
import { verifySupabaseOnStartup } from "./config/supabase-health";
import { startFollowUpReminderWorker } from "./services/reminder-worker.service";

validateEnvironmentVariables();

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

const port = Number(process.env.PORT || process.env.WEBSITES_PORT) || 8080;
const host = (process.env.HOST || "0.0.0.0").trim();

const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

async function startServer() {
  const nodeEnv = process.env.NODE_ENV || "production";
  if (nodeEnv !== "production") {
    console.warn(
      `[startup] NODE_ENV=${nodeEnv} (set NODE_ENV=production on Azure App Service for correct CORS/HTTPS behavior)`
    );
  } else {
    console.log("[startup] NODE_ENV=production");
  }
  console.log(
    `[startup] bind HOST=${host} PORT=${port} (env PORT=${process.env.PORT ?? "unset"} WEBSITES_PORT=${process.env.WEBSITES_PORT ?? "unset"} HOST=${process.env.HOST ?? "unset"})`
  );
  await verifySupabaseOnStartup();

  const app = await createServer();

  app.use(
    express.static(distPath, {
      index: false,
      maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    })
  );

  // Express 5: avoid `app.get("*")` (path-to-regexp v8); use middleware for SPA fallback.
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) next(err);
    });
  });

  registerAppErrorHandlers(app);

  app.listen(port, host, () => {
    const publicUrl =
      process.env.PUBLIC_URL?.trim() ||
      `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
    console.log(`[startup] Server ready — ${host}:${port}`);
    console.log(`[startup] SPA static root: ${distPath}`);
    console.log(`[startup] PUBLIC_URL (for docs/links): ${publicUrl}`);
    startFollowUpReminderWorker();
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down");
  process.exit(0);
});
