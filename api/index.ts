import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { globalErrorHandler } from "../backend/middleware/errorHandler.js";
import notionRouter from "../backend/routes/notion.js";
import aiRouter from "../backend/routes/ai.js";

dotenv.config();

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));

// CORS — allow Capacitor WebView and any frontend origin
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", aiRouter);
app.use("/api/notion", notionRouter);
app.use(globalErrorHandler);

export default app;
