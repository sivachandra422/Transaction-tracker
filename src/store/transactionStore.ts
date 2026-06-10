import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Transaction, CategorizationRule } from "../types";
import { DEFAULT_RULES, STORAGE_KEYS } from "../constants";
import { db } from "../services/db";
import { requestPush, syncNow } from "../services/syncEngine";
import { nowISO } from "../lib/format";

interface TransactionState {
  transactions: Transaction[];
  rules: CategorizationRule[];
  hydrated: boolean;
  init: () => Promise<void>;
  /** Reload in-memory list from Dexie (after background sync merges). */
  rehydrate: () => Promise<void>;
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;
  markSynced: (id: string, notionPageId: string, notionUrl: string) => void;
  addRule: (rule: CategorizationRule) => void;
  deleteRule: (id: string) => void;
  resetRules: () => void;
}

/** Live (non-tombstoned) rows, newest first. */
async function loadLive(): Promise<Transaction[]> {
  const all = await db.transactions.orderBy("createdAt").reverse().toArray();
  return all.filter((t) => !t.deletedAt);
}

function stamp(tx: Transaction): Transaction {
  return { ...tx, updatedAt: nowISO(), dirty: 1 };
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      rules: DEFAULT_RULES,
      hydrated: false,

      init: async () => {
        set({ transactions: await loadLive(), hydrated: true });
        // Background cloud sync; rehydrate if remote changes merged in.
        void syncNow().then((changed) => {
          if (changed) void get().rehydrate();
        });
      },

      rehydrate: async () => {
        set({ transactions: await loadLive() });
      },

      addTransaction: (tx) => {
        const stamped = stamp(tx);
        set((s) => ({ transactions: [stamped, ...s.transactions] }));
        db.transactions.put(stamped).catch(console.error);
        requestPush();
      },

      updateTransaction: (tx) => {
        const stamped = stamp(tx);
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === stamped.id ? stamped : t)),
        }));
        db.transactions.put(stamped).catch(console.error);
        requestPush();
      },

      deleteTransaction: (id) => {
        // Soft delete: tombstone locally so the deletion propagates to the cloud.
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
        db.transactions
          .get(id)
          .then((tx) => {
            if (!tx) return;
            return db.transactions.put({ ...stamp(tx), deletedAt: nowISO() });
          })
          .catch(console.error);
        requestPush();
      },

      clearTransactions: () => {
        const now = nowISO();
        set({ transactions: [] });
        db.transactions
          .toCollection()
          .modify((t: Transaction) => {
            t.deletedAt = now;
            t.updatedAt = now;
            t.dirty = 1;
          })
          .catch(console.error);
        requestPush();
      },

      markSynced: (id, notionPageId, notionUrl) => {
        set((s) => {
          const updated = s.transactions.map((t) =>
            t.id === id ? stamp({ ...t, synced: true, notionPageId, notionUrl }) : t
          );
          const synced = updated.find((t) => t.id === id);
          if (synced) db.transactions.put(synced).catch(console.error);
          return { transactions: updated };
        });
        requestPush();
      },

      addRule: (rule) => set((s) => ({ rules: [rule, ...s.rules] })),
      deleteRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
      resetRules: () => set({ rules: DEFAULT_RULES }),
    }),
    {
      name: STORAGE_KEYS.TRANSACTIONS,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ rules: state.rules }),
    }
  )
);
