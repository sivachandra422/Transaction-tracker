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

const router = Router();
router.use(notionRateLimiter);

// ─── POST /api/notion/search-pages ───────────────────────────────────────────
router.post(
  "/search-pages",
  asyncHandler(async (req, res) => {
    const parsed = searchPagesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: formatZodError(parsed.error) });
      return;
    }

    const pages = await searchPages(parsed.data.notionToken);
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

    const databases = await searchDatabases(parsed.data.notionToken);
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

    const result = await createDatabase(
      parsed.data.notionToken,
      parsed.data.parentPageId,
      parsed.data.title
    );
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

    const result = await verifyDatabase(parsed.data.notionToken, parsed.data.notionDatabaseId);
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

    const result = await syncTransaction(parsed.data);
    res.json({ success: true, ...result });
  })
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatZodError(error: ZodError): string {
  return error.issues.map((e) => e.message).join("; ");
}

export default router;
