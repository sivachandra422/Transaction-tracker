export interface Transaction {
  id: string;
  amount: number;
  description: string;
  merchant: string;
  category: "Food" | "Groceries" | "Transport" | "Utilities" | "Shopping" | "Entertainment" | "Housing" | "Income" | "Other";
  type: "expense" | "income";
  date: string; // YYYY-MM-DD
  labels: string[];
  /** Synced to Notion */
  synced: boolean;
  notionPageId?: string;
  notionUrl?: string;
  createdAt: string; // ISO timestamp
  /** Last local modification — drives last-write-wins cloud merge */
  updatedAt: string; // ISO timestamp
  /** Soft-delete tombstone for cloud sync (null/undefined = live) */
  deletedAt?: string | null;
  /** 1 = pending cloud push (Dexie cannot index booleans) */
  dirty?: 0 | 1;
}

export interface NotionConfig {
  notionDatabaseId: string;
  autoSync: boolean;
  databaseTitle?: string;
  /** True when the backend has a saved Notion token for this user. */
  hasServerToken?: boolean;
}

export interface LlmConfig {
  provider: "gemini" | "openrouter" | "openai";
  model: string;
  /** True when the backend has a saved LLM API key for this user. */
  hasServerApiKey?: boolean;
}

export interface CategorizationRule {
  id: string;
  keyword: string; // keyword/phrase to search for in description or merchant
  category: CategoryType;
}

export type CategoryType = Transaction["category"];

export type TabId = "dashboard" | "add" | "rules" | "charts" | "notion" | "ai";
