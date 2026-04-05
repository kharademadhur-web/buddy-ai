import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

let expressServer: any = null;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    fs: {
      allow: ["./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
    proxy: {
      "^/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
    middleware: [
      // Ensure SPA routing works - fallback to index.html for non-API routes
      (req, res, next) => {
        if (req.method !== "GET") {
          next();
          return;
        }
        if (req.url.startsWith("/api")) {
          next();
          return;
        }
        next();
      },
    ],
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [
    react(),
    {
      name: "express-dev-server",
      apply: "serve",
      async configResolved() {
        // Vitest bootstraps Vite internally; don't start an HTTP server during tests.
        if (process.env.VITEST) return;
        if (!expressServer) {
          console.log("[Server] Starting Express server...");
          expressServer = "starting";

          // Start server asynchronously without blocking Vite
          setImmediate(async () => {
            try {
              console.log("[Server] Importing createServer...");
              const module = await import("./server/index.ts");
              const { createServer } = module;

              console.log("[Server] Creating app instance...");
              const app = await createServer();

              console.log("[Server] Listening on port 3000...");
              app.listen(3000, "127.0.0.1", () => {
                console.log("✓ Express API server running on http://localhost:3000");
                expressServer = true;
              });
            } catch (error) {
              console.error("[Server] Startup error:", error instanceof Error ? error.message : error);
              expressServer = false;
            }
          });
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}))
