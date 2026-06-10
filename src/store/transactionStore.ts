import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Transaction, CategorizationRule } from "../types";
import { DEFAULT_RULES, STORAGE_KEYS } from "../constants";
import { db } from "../services/db";
import {
  sbUpsertTransaction,
  sbDeleteTransaction,
  sbFetchAllTransactions,
  sbClearTransactions,
} from "../services/supabase";

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
  syncFromSupabase: () => Promise<void>;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      rules: DEFAULT_RULES,
      hydrated: false,

      // ── Init: load from local Dexie, then merge remote Supabase ─────────────
      init: async () => {
        const local = await db.transactions.orderBy("createdAt").reverse().toArray();
        set({ transactions: local, hydrated: true });

        // Background: fetch remote and merge (offline-first)
        try {
          const remote = await sbFetchAllTransactions();
          if (remote.length === 0) {
            // Push local transactions up to Supabase on first connect
            await Promise.all(local.map((tx) => sbUpsertTransaction(tx)));
          } else {
            // Merge: remote is source of truth for synced items
            const localIds = new Set(local.map((t) => t.id));
            const remoteOnly = remote.filter((t) => !localIds.has(t.id));
            if (remoteOnly.length > 0) {
              await db.transactions.bulkPut(remoteOnly);
              const merged = await db.transactions.orderBy("createdAt").reverse().toArray();
              set({ transactions: merged });
            }
          }
        } catch {
          // Network unavailable — use local only
        }
      },

      addTransaction: (tx) => {
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        db.transactions.put(tx).catch(console.error);
        sbUpsertTransaction(tx).catch(console.error);
      },

      updateTransaction: (tx) => {
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === tx.id ? tx : t)),
        }));
        db.transactions.put(tx).catch(console.error);
        sbUpsertTransaction(tx).catch(console.error);
      },

      deleteTransaction: (id) => {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
        db.transactions.delete(id).catch(console.error);
        sbDeleteTransaction(id).catch(console.error);
      },

      clearTransactions: () => {
        set({ transactions: [] });
        db.transactions.clear().catch(console.error);
        sbClearTransactions().catch(console.error);
      },

      markSynced: (id, notionPageId, notionUrl) => {
        set((s) => {
          const updated = s.transactions.map((t) =>
            t.id === id ? { ...t, synced: true, notionPageId, notionUrl } : t
          );
          const synced = updated.find((t) => t.id === id);
          if (synced) {
            db.transactions.put(synced).catch(console.error);
            sbUpsertTransaction(synced).catch(console.error);
          }
          return { transactions: updated };
        });
      },

      addRule: (rule) => set((s) => ({ rules: [rule, ...s.rules] })),
      deleteRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
      resetRules: () => set({ rules: DEFAULT_RULES }),

      syncFromSupabase: async () => {
        try {
          const remote = await sbFetchAllTransactions();
          await db.transactions.clear();
          if (remote.length > 0) await db.transactions.bulkPut(remote);
          set({ transactions: remote });
        } catch (err) {
          console.error("[sync] Supabase pull failed:", err);
        }
      },

      _unused: get,
    }),
    {
      name: STORAGE_KEYS.TRANSACTIONS,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ rules: state.rules }),
    }
  )
);
