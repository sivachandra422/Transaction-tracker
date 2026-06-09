import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Transaction, CategorizationRule } from "../types";
import { DEFAULT_RULES, STORAGE_KEYS } from "../constants";

interface TransactionState {
  transactions: Transaction[];
  rules: CategorizationRule[];
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;
  markSynced: (id: string, notionPageId: string, notionUrl: string) => void;
  addRule: (rule: CategorizationRule) => void;
  deleteRule: (id: string) => void;
  resetRules: () => void;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set) => ({
      transactions: [],
      rules: DEFAULT_RULES,
      addTransaction: (tx) =>
        set((s) => ({ transactions: [tx, ...s.transactions] })),
      updateTransaction: (tx) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === tx.id ? tx : t)),
        })),
      deleteTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),
      clearTransactions: () => set({ transactions: [] }),
      markSynced: (id, notionPageId, notionUrl) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, synced: true, notionPageId, notionUrl } : t
          ),
        })),
      addRule: (rule) =>
        set((s) => ({ rules: [rule, ...s.rules] })),
      deleteRule: (id) =>
        set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
      resetRules: () => set({ rules: DEFAULT_RULES }),
    }),
    {
      name: STORAGE_KEYS.TRANSACTIONS,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
