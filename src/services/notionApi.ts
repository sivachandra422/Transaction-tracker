import { apiFetch } from "./apiClient";
import { supabase } from "./supabase";
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

export interface NotionConfigResult {
  hasToken: boolean;
  notionDatabaseId: string;
  autoSync: boolean;
  databaseTitle: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in. Please sign in to use Notion sync.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function loadNotionConfig(): Promise<NotionConfigResult> {
  const headers = await authHeaders();
  return apiFetch<NotionConfigResult>("/api/secrets/notion", { headers });
}

export async function saveNotionSecret(params: {
  notionToken?: string;
  notionDatabaseId: string;
  autoSync: boolean;
  databaseTitle?: string;
}): Promise<void> {
  const headers = await authHeaders();
  await apiFetch("/api/secrets/notion", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
}

export async function searchNotionPages(): Promise<NotionPage[]> {
  const headers = await authHeaders();
  const data = await apiFetch<{ success: boolean; pages: NotionPage[] }>(
    "/api/notion/search-pages",
    { method: "POST", headers, body: JSON.stringify({}) }
  );
  return data.pages;
}

export async function searchNotionDatabases(): Promise<NotionDatabase[]> {
  const headers = await authHeaders();
  const data = await apiFetch<{ success: boolean; databases: NotionDatabase[] }>(
    "/api/notion/search-databases",
    { method: "POST", headers, body: JSON.stringify({}) }
  );
  return data.databases;
}

export async function createNotionDatabase(
  parentPageId: string,
  title?: string
): Promise<NotionDatabase> {
  const headers = await authHeaders();
  const data = await apiFetch<{ success: boolean } & NotionDatabase>(
    "/api/notion/create-database",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ parentPageId, title }),
    }
  );
  return { databaseId: data.databaseId, title: data.title, url: data.url };
}

export async function verifyNotionDatabase(
  notionDatabaseId: string
): Promise<NotionVerifyResult> {
  const headers = await authHeaders();
  const data = await apiFetch<{ success: boolean } & NotionVerifyResult>(
    "/api/notion/verify",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ notionDatabaseId }),
    }
  );
  return { title: data.title, properties: data.properties };
}

export async function syncToNotion(
  notionDatabaseId: string,
  transaction: Transaction
): Promise<NotionSyncResult> {
  const headers = await authHeaders();
  const data = await apiFetch<{ success: boolean } & NotionSyncResult>(
    "/api/notion/sync",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ notionDatabaseId, transaction }),
    }
  );
  return { id: data.id, url: data.url };
}
