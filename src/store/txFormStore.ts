import { create } from "zustand";
import type { CategoryType, Transaction } from "../types";
import type { ParsedTransactionResult } from "../services/aiApi";
import { todayISO } from "../lib/format";

/** Draft state for the Add/Edit transaction form (shared across screens). */
interface TxFormState {
  editingTxId: string | null;
  type: "expense" | "income";
  amount: string;
  description: string;
  merchant: string;
  date: string;
  category: CategoryType;
  labels: string;
  /** User picked a category manually — suppress auto-suggestions */
  manualCategory: boolean;
  /** Informational note from the AI parser (e.g. fallback used) */
  aiNote: string;

  patch: (partial: Partial<Omit<TxFormState, "patch" | "reset" | "loadTransaction" | "fillFromAi">>) => void;
  reset: () => void;
  loadTransaction: (tx: Transaction) => void;
  fillFromAi: (info: ParsedTransactionResult) => void;
}

const EMPTY = {
  editingTxId: null as string | null,
  type: "expense" as const,
  amount: "",
  description: "",
  merchant: "",
  date: todayISO(),
  category: "Other" as CategoryType,
  labels: "",
  manualCategory: false,
  aiNote: "",
};

export const useTxFormStore = create<TxFormState>()((set) => ({
  ...EMPTY,

  patch: (partial) => set(partial),

  reset: () => set({ ...EMPTY, date: todayISO() }),

  loadTransaction: (tx) =>
    set({
      editingTxId: tx.id,
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description,
      merchant: tx.merchant,
      date: tx.date,
      category: tx.category,
      labels: tx.labels.join(", "),
      manualCategory: true,
      aiNote: "",
    }),

  fillFromAi: (info) =>
    set({
      editingTxId: null,
      type: info.type === "income" ? "income" : "expense",
      amount: String(info.amount || ""),
      description: info.description || "",
      merchant: info.merchant || "",
      date: info.date || todayISO(),
      category: (info.category || "Other") as CategoryType,
      labels: Array.isArray(info.labels) ? info.labels.join(", ") : "",
      manualCategory: false,
      aiNote: info.isFallback
        ? "⚡ AI was busy — smart local parsing decoded this transaction. Confirm and save."
        : "",
    }),
}));
