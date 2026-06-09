export interface Transaction {
  id: string;
  amount: number;
  description: string;
  merchant: string;
  category: "Food" | "Groceries" | "Transport" | "Utilities" | "Shopping" | "Entertainment" | "Housing" | "Income" | "Other";
  type: "expense" | "income";
  date: string;
  labels: string[];
  synced: boolean;
  notionPageId?: string;
  notionUrl?: string;
  createdAt: string;
}

export interface NotionConfig {
  notionToken: string;
  notionDatabaseId: string;
  autoSync: boolean;
  databaseTitle?: string;
}

export interface LlmConfig {
  provider: "gemini" | "openrouter" | "openai";
  apiKey: string;
  model: string;
}

export interface CategorizationRule {
  id: string;
  keyword: string; // keyword/phrase to search for in description or merchant
  category: CategoryType;
}

export type CategoryType = Transaction["category"];

