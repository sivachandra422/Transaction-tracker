import { apiFetch } from "./apiClient";

export interface AiParsePayload {
  text?: string;
  image?: string;
  imageType?: string;
  provider: string;
  apiKey: string;
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

export async function parseTransactionAi(payload: AiParsePayload): Promise<ParsedTransactionResult> {
  return apiFetch<ParsedTransactionResult>("/api/gemini/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
