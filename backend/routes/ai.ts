import { Router } from "express";
import { ZodError } from "zod";
import { aiParseSchema } from "../validators/aiValidators.js";
import { parseTransaction, buildFallback } from "../services/aiService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { aiRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();
router.use(aiRateLimiter);

// ─── POST /api/gemini/parse ───────────────────────────────────────────────────
router.post(
  "/gemini/parse",
  asyncHandler(async (req, res) => {
    const parsed = aiParseSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      res.status(400).json({ error: msg });
      return;
    }

    const input = parsed.data;
    const serverGeminiKey = process.env.GEMINI_API_KEY;

    try {
      const result = await parseTransaction(input, serverGeminiKey);
      res.json(result);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const fallback = buildFallback(input.text, input.provider, input.model ?? "gemini-3.5-flash", reason);
      res.json(fallback);
    }
  })
);

export { ZodError };
export default router;
