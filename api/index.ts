import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { globalErrorHandler } from "../backend/middleware/errorHandler.js";
import notionRouter from "../backend/routes/notion.js";
import aiRouter from "../backend/routes/ai.js";
import secretsRouter from "../backend/routes/secrets.js";

dotenv.config();

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));

// CORS — restrict to configured origins; Capacitor WebView origins always allowed.
// Set ALLOWED_ORIGINS="https://app.example.com,https://other.com" in production.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const CAPACITOR_ORIGINS = ["capacitor://localhost", "http://localhost", "https://localhost"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowAny = allowedOrigins.length === 0; // unset = open (dev-friendly default)
  if (
    allowAny ||
    (origin && (allowedOrigins.includes(origin) || CAPACITOR_ORIGINS.includes(origin)))
  ) {
    res.setHeader("Access-Control-Allow-Origin", allowAny ? "*" : (origin as string));
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", aiRouter);
app.use("/api/notion", notionRouter);
app.use("/api/secrets", secretsRouter);
app.use(globalErrorHandler);

export default app;
