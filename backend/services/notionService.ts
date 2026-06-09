import { SyncInput } from "../validators/notionValidators.js";

const NOTION_VERSION = "2022-06-28";
const NOTION_BASE = "https://api.notion.com/v1";
const FETCH_TIMEOUT_MS = 15_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function notionFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    const json = JSON.parse(text) as { message?: string };
    return json.message || fallback;
  } catch {
    return fallback;
  }
}

// ─── Typed return shapes ──────────────────────────────────────────────────────

export interface PageResult {
  id: string;
  title: string;
  url: string;
}

export interface DatabaseResult {
  databaseId: string;
  title: string;
  url: string;
}

export interface VerifyResult {
  title: string;
  properties: string[];
}

export interface SyncResult {
  id: string;
  url: string;
}

// ─── Search pages ─────────────────────────────────────────────────────────────

export async function searchPages(notionToken: string): Promise<PageResult[]> {
  const res = await notionFetch(`${NOTION_BASE}/search`, {
    method: "POST",
    headers: notionHeaders(notionToken),
    body: JSON.stringify({ filter: { property: "object", value: "page" } }),
  });

  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to search Notion workspace.");
    const err = mapNotionStatus(res.status, msg);
    throw err;
  }

  const data = (await res.json()) as { results: NotionPageObject[] };
  return (data.results ?? []).map(pageToResult);
}

// ─── Create database ──────────────────────────────────────────────────────────

export async function createDatabase(
  notionToken: string,
  parentPageId: string,
  title = "FinSnap Smart Ledger"
): Promise<DatabaseResult> {
  const body = buildDatabaseSchema(parentPageId, title);

  const res = await notionFetch(`${NOTION_BASE}/databases`, {
    method: "POST",
    headers: notionHeaders(notionToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to create Notion database.");
    throw mapNotionStatus(res.status, msg);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { databaseId: data.id, title, url: data.url };
}

// ─── Verify database ──────────────────────────────────────────────────────────

export async function verifyDatabase(
  notionToken: string,
  databaseId: string
): Promise<VerifyResult> {
  const res = await notionFetch(`${NOTION_BASE}/databases/${databaseId}`, {
    method: "GET",
    headers: notionHeaders(notionToken),
  });

  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Could not verify Notion database connection.");
    throw mapNotionStatus(res.status, msg);
  }

  const info = (await res.json()) as {
    title: Array<{ plain_text?: string }>;
    properties: Record<string, unknown>;
  };
  return {
    title: info.title?.[0]?.plain_text ?? "Notion Database",
    properties: Object.keys(info.properties ?? {}),
  };
}

// ─── Sync transaction ─────────────────────────────────────────────────────────

export async function syncTransaction(input: SyncInput): Promise<SyncResult> {
  const { notionToken, notionDatabaseId, transaction } = input;

  const properties = buildTransactionProperties(transaction);
  const payload = { parent: { database_id: notionDatabaseId }, properties };

  const res = await notionFetch(`${NOTION_BASE}/pages`, {
    method: "POST",
    headers: notionHeaders(notionToken),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await extractErrorMessage(res, "Failed to write transaction to Notion.");
    throw mapNotionStatus(res.status, msg);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

interface NotionPageObject {
  id: string;
  url: string;
  properties?: Record<string, { type: string; title?: Array<{ plain_text: string }> }>;
}

function pageToResult(page: NotionPageObject): PageResult {
  let title = "Untitled Page";
  const props = page.properties ?? {};
  const titleProp = Object.values(props).find((p) => p.type === "title");
  if (titleProp?.title && titleProp.title.length > 0) {
    title = titleProp.title.map((t) => t.plain_text).join("") || title;
  }
  return { id: page.id, title, url: page.url };
}

function buildDatabaseSchema(parentPageId: string, title: string) {
  return {
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: title } }],
    properties: {
      Name: { title: {} },
      Amount: { number: { format: "rupee" } },
      Category: {
        select: {
          options: [
            { name: "Food", color: "orange" },
            { name: "Groceries", color: "green" },
            { name: "Transport", color: "blue" },
            { name: "Utilities", color: "purple" },
            { name: "Shopping", color: "yellow" },
            { name: "Entertainment", color: "pink" },
            { name: "Housing", color: "red" },
            { name: "Income", color: "green" },
            { name: "Other", color: "default" },
          ],
        },
      },
      Type: {
        select: {
          options: [
            { name: "Income", color: "green" },
            { name: "Expense", color: "red" },
          ],
        },
      },
      Merchant: { rich_text: {} },
      Date: { date: {} },
      Labels: { multi_select: {} },
    },
  };
}

function buildTransactionProperties(
  transaction: SyncInput["transaction"]
): Record<string, unknown> {
  const { amount, description, merchant, category, type, date, labels } = transaction;

  const props: Record<string, unknown> = {
    Name: { title: [{ text: { content: description || "Unnamed Transaction" } }] },
    Amount: { number: Number(amount) || 0 },
    Category: { select: { name: category || "Other" } },
    Type: { select: { name: type === "income" ? "Income" : "Expense" } },
    Merchant: { rich_text: [{ text: { content: merchant || "" } }] },
    Date: { date: { start: date || new Date().toISOString().split("T")[0] } },
  };

  const cleanLabels = (labels ?? [])
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  if (cleanLabels.length > 0) {
    props.Labels = { multi_select: cleanLabels.map((l: string) => ({ name: l })) };
  }

  return props;
}

/** Map Notion HTTP status codes to user-friendly errors. */
function mapNotionStatus(status: number, message: string): Error {
  const userMessages: Record<number, string> = {
    400: `Invalid request sent to Notion: ${message}`,
    401: "Notion API token is invalid or has expired. Please update it in settings.",
    403: "Your Notion integration does not have permission to access this resource.",
    404: "Notion page or database was not found. It may have been deleted.",
    429: "Notion rate limit reached. Please wait a moment and try again.",
  };
  const err = new Error(userMessages[status] ?? `Notion returned an error (${status}): ${message}`);
  (err as NodeJS.ErrnoException).code = String(status);
  return err;
}
