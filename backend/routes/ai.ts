import { Router } from "express";
import { ZodError } from "zod";
import { aiParseSchema, type AiParseInput } from "../validators/aiValidators.js";
import { parseTransaction, buildFallback } from "../services/aiService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { aiRateLimiter } from "../middleware/rateLimiter.js";
import { verifyJwt, getUserSecrets } from "../services/supabaseAdmin.js";

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

    const input: AiParseInput = { ...parsed.data };
    const serverGeminiKey = process.env.GEMINI_API_KEY;

    // Prefer server-side key when user is authenticated
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const userId = await verifyJwt(authHeader.slice(7));
        const secrets = await getUserSecrets(userId);
        if (secrets?.llm_api_key) {
          input.apiKey = secrets.llm_api_key;
          input.provider = (secrets.llm_provider as AiParseInput["provider"]) ?? input.provider;
          input.model = secrets.llm_model ?? input.model;
        }
      } catch {
        // Not authenticated or secret fetch failed — proceed with body/env key
      }
    }

    try {
      const result = await parseTransaction(input, serverGeminiKey);
      res.json(result);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const fallback = buildFallback(
        input.text,
        input.provider,
        input.model ?? "gemini-2.5-flash",
        reason
      );
      res.json(fallback);
    }
  })
);

export { ZodError };
export default router;
