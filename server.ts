import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";

import { globalErrorHandler } from "./backend/middleware/errorHandler.js";
import notionRouter from "./backend/routes/notion.js";
import aiRouter from "./backend/routes/ai.js";
import secretsRouter from "./backend/routes/secrets.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // ─── Security & logging ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite dev server injects inline scripts
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(morgan("dev"));

  // ─── Body parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));

  // ─── Health check ────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── Feature routes ──────────────────────────────────────────────────────────
  app.use("/api", aiRouter);
  app.use("/api/notion", notionRouter);
  app.use("/api/secrets", secretsRouter);

  // ─── Frontend static / dev middleware ────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // ─── Global error handler (must be last) ────────────────────────────────────
  app.use(globalErrorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();
