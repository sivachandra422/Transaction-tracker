import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Transaction, CategorizationRule } from "../types";
import { DEFAULT_RULES, STORAGE_KEYS } from "../constants";
import { db } from "../services/db";

interface TransactionState {
  transactions: Transaction[];
  rules: CategorizationRule[];
  hydrated: boolean;
  init: () => Promise<void>;
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
      hydrated: false,

      init: async () => {
        const stored = await db.transactions.orderBy("createdAt").reverse().toArray();
        set({ transactions: stored, hydrated: true });
      },

      addTransaction: (tx) => {
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        db.transactions.put(tx).catch(console.error);
      },

      updateTransaction: (tx) => {
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === tx.id ? tx : t)),
        }));
        db.transactions.put(tx).catch(console.error);
      },

      deleteTransaction: (id) => {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
        db.transactions.delete(id).catch(console.error);
      },

      clearTransactions: () => {
        set({ transactions: [] });
        db.transactions.clear().catch(console.error);
      },

      markSynced: (id, notionPageId, notionUrl) => {
        set((s) => {
          const updated = s.transactions.map((t) =>
            t.id === id ? { ...t, synced: true, notionPageId, notionUrl } : t
          );
          const synced = updated.find((t) => t.id === id);
          if (synced) db.transactions.put(synced).catch(console.error);
          return { transactions: updated };
        });
      },

      addRule: (rule) =>
        set((s) => ({ rules: [rule, ...s.rules] })),

      deleteRule: (id) =>
        set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

      resetRules: () => set({ rules: DEFAULT_RULES }),
    }),
    {
      name: STORAGE_KEYS.TRANSACTIONS,
      storage: createJSONStorage(() => localStorage),
      // Transactions persist to Dexie; only rules go to localStorage
      partialize: (state) => ({ rules: state.rules }),
    }
  )
);
