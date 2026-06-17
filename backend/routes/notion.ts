import { Router } from "express";
import { ZodError } from "zod";
import {
  searchPagesSchema,
  createDatabaseSchema,
  verifySchema,
  syncSchema,
} from "../validators/notionValidators.js";
import {
  searchPages,
  searchDatabases,
  createDatabase,
  verifyDatabase,
  syncTransaction,
} from "../services/notionService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { notionRateLimiter } from "../middleware/rateLimiter.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getUserSecrets } from "../services/supabaseAdmin.js";

const router = Router();
router.use(notionRateLimiter);
router.use(requireAuth);

async function getNotionToken(userId: string): Promise<string> {
  const secrets = await getUserSecrets(userId);
  if (!secrets?.notion_token) {
    throw Object.assign(
      new Error("No Notion token saved. Please configure it in settings."),
      { status: 400 }
    );
  }
  return secrets.notion_token;
}

// ─── POST /api/notion/search-pages ───────────────────────────────────────────
router.post(
  "/search-pages",
  asyncHandler(async (req, res) => {
    const parsed = searchPagesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError(parsed.error) });
      return;
    }
    const token = await getNotionToken(req.userId!);
    const pages = await searchPages(token);
    res.json({ success: true, pages });
  })
);

// ─── POST /api/notion/search-databases ───────────────────────────────────────
router.post(
  "/search-databases",
  asyncHandler(async (req, res) => {
    const parsed = searchPagesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError(parsed.error) });
      return;
    }
    const token = await getNotionToken(req.userId!);
    const databases = await searchDatabases(token);
    res.json({ success: true, databases });
  })
);

// ─── POST /api/notion/create-database ────────────────────────────────────────
router.post(
  "/create-database",
  asyncHandler(async (req, res) => {
    const parsed = createDatabaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError(parsed.error) });
      return;
    }
    const token = await getNotionToken(req.userId!);
    const result = await createDatabase(token, parsed.data.parentPageId, parsed.data.title);
    res.json({ success: true, ...result });
  })
);

// ─── POST /api/notion/verify ─────────────────────────────────────────────────
router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError(parsed.error) });
      return;
    }
    const token = await getNotionToken(req.userId!);
    const result = await verifyDatabase(token, parsed.data.notionDatabaseId);
    res.json({ success: true, ...result });
  })
);

// ─── POST /api/notion/sync ───────────────────────────────────────────────────
router.post(
  "/sync",
  asyncHandler(async (req, res) => {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError(parsed.error) });
      return;
    }
    const token = await getNotionToken(req.userId!);
    const result = await syncTransaction(token, parsed.data);
    res.json({ success: true, ...result });
  })
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.issues.map((e) => e.message).join("; ");
}

export default router;
