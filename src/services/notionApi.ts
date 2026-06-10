import { apiFetch } from "./apiClient";
import type { Transaction } from "../types";

export interface NotionPage {
  id: string;
  title: string;
  url: string;
}

export interface NotionDatabase {
  databaseId: string;
  title: string;
  url: string;
}

export interface NotionVerifyResult {
  title: string;
  properties: string[];
}

export interface NotionSyncResult {
  id: string;
  url: string;
}

export async function searchNotionPages(notionToken: string): Promise<NotionPage[]> {
  const data = await apiFetch<{ success: boolean; pages: NotionPage[] }>(
    "/api/notion/search-pages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notionToken }),
    }
  );
  return data.pages;
}

export async function createNotionDatabase(
  notionToken: string,
  parentPageId: string,
  title?: string
): Promise<NotionDatabase> {
  const data = await apiFetch<{ success: boolean } & NotionDatabase>(
    "/api/notion/create-database",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notionToken, parentPageId, title }),
    }
  );
  return { databaseId: data.databaseId, title: data.title, url: data.url };
}

export async function verifyNotionDatabase(
  notionToken: string,
  notionDatabaseId: string
): Promise<NotionVerifyResult> {
  const data = await apiFetch<{ success: boolean } & NotionVerifyResult>(
    "/api/notion/verify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notionToken, notionDatabaseId }),
    }
  );
  return { title: data.title, properties: data.properties };
}

export async function syncToNotion(
  notionToken: string,
  notionDatabaseId: string,
  transaction: Transaction
): Promise<NotionSyncResult> {
  const data = await apiFetch<{ success: boolean } & NotionSyncResult>(
    "/api/notion/sync",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notionToken, notionDatabaseId, transaction }),
    }
  );
  return { id: data.id, url: data.url };
}
