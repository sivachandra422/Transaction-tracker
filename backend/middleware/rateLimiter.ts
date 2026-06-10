import rateLimit from "express-rate-limit";

export const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many AI requests. Please wait a moment and try again." },
});

export const notionRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many Notion requests. Please wait a moment and try again." },
});
