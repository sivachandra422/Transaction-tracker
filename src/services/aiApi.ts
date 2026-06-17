import { apiFetch } from "./apiClient";
import { supabase } from "./supabase";

export interface AiParsePayload {
  text?: string;
  image?: string;
  imageType?: string;
  provider: string;
  model: string;
}

export interface ParsedTransactionResult {
  amount: number;
  description: string;
  merchant: string;
  category: string;
  type: "expense" | "income";
  date: string;
  labels: string[];
  isFallback: boolean;
  fallbackReason?: string;
  usingProvider: string;
  usingModel: string;
}

export interface AiConfigResult {
  hasApiKey: boolean;
  provider: string;
  model: string;
}

async function tryGetAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in. Please sign in to save AI settings.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function parseTransactionAi(
  payload: AiParsePayload
): Promise<ParsedTransactionResult> {
  const token = await tryGetAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return apiFetch<ParsedTransactionResult>("/api/gemini/parse", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function saveAiSecret(params: {
  apiKey?: string;
  provider: string;
  model: string;
}): Promise<void> {
  const headers = await authHeaders();
  await apiFetch("/api/secrets/llm", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
}

export async function loadAiConfig(): Promise<AiConfigResult> {
  const headers = await authHeaders();
  return apiFetch<AiConfigResult>("/api/secrets/llm", { headers });
}
