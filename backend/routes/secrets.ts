import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { getUserSecrets, upsertUserSecrets } from "../services/supabaseAdmin.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();
router.use(requireAuth);

const notionSecretSchema = z.object({
  notionToken: z.string().optional(),
  notionDatabaseId: z.string().default(""),
  autoSync: z.boolean().default(false),
  databaseTitle: z.string().optional(),
});

const llmSecretSchema = z.object({
  apiKey: z.string().optional(),
  provider: z.enum(["gemini", "openrouter", "openai"]).default("gemini"),
  model: z.string().default("gemini-2.5-flash"),
});

// GET /api/secrets/notion
router.get(
  "/notion",
  asyncHandler(async (req, res) => {
    const secrets = await getUserSecrets(req.userId!);
    res.json({
      success: true,
      hasToken: !!(secrets?.notion_token),
      notionDatabaseId: secrets?.notion_database_id ?? "",
      autoSync: secrets?.notion_auto_sync ?? false,
      databaseTitle: secrets?.notion_database_title ?? "",
    });
  })
);

// POST /api/secrets/notion
router.post(
  "/notion",
  asyncHandler(async (req, res) => {
    const parsed = notionSecretSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues.map((e) => e.message).join("; "),
      });
      return;
    }
    const { notionToken, notionDatabaseId, autoSync, databaseTitle } = parsed.data;
    const update: Parameters<typeof upsertUserSecrets>[1] = {
      notion_database_id: notionDatabaseId,
      notion_auto_sync: autoSync,
      notion_database_title: databaseTitle ?? null,
    };
    if (notionToken) update.notion_token = notionToken;
    await upsertUserSecrets(req.userId!, update);
    res.json({ success: true });
  })
);

// GET /api/secrets/llm
router.get(
  "/llm",
  asyncHandler(async (req, res) => {
    const secrets = await getUserSecrets(req.userId!);
    res.json({
      success: true,
      hasApiKey: !!(secrets?.llm_api_key),
      provider: secrets?.llm_provider ?? "gemini",
      model: secrets?.llm_model ?? "gemini-2.5-flash",
    });
  })
);

// POST /api/secrets/llm
router.post(
  "/llm",
  asyncHandler(async (req, res) => {
    const parsed = llmSecretSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues.map((e) => e.message).join("; "),
      });
      return;
    }
    const { apiKey, provider, model } = parsed.data;
    const update: Parameters<typeof upsertUserSecrets>[1] = { llm_provider: provider, llm_model: model };
    if (apiKey) update.llm_api_key = apiKey;
    await upsertUserSecrets(req.userId!, update);
    res.json({ success: true });
  })
);

export default router;
