import "dotenv/config";
import { createServer, registerAppErrorHandlers } from "./server/index.ts";

async function startDevServer() {
  console.log("Starting development server...");

  try {
    const app = await createServer();
    registerAppErrorHandlers(app);

    const PORT = 3000;
    app.listen(PORT, "127.0.0.1", () => {
      console.log(`\n✓ Express API server running on http://localhost:${PORT}`);
      console.log(`✓ Ready to accept requests at /api/*\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startDevServer();
