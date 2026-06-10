import Dexie, { type Table } from "dexie";
import type { Transaction } from "../types";

interface MetaRow {
  key: string;
  value: string;
}

class AppDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("finsnap_ledger_v1");

    this.version(1).stores({
      transactions: "id, date, category, type, synced, createdAt",
    });

    // v2: cloud-sync fields (updatedAt for LWW merge, dirty outbox flag,
    // soft-delete tombstones) + meta table for sync cursors.
    this.version(2)
      .stores({
        transactions: "id, date, category, type, synced, createdAt, updatedAt, dirty",
        meta: "key",
      })
      .upgrade((tx) =>
        tx
          .table("transactions")
          .toCollection()
          .modify((t: Transaction) => {
            t.updatedAt = t.updatedAt ?? t.createdAt;
            t.dirty = 1; // push everything on first sync after upgrade
            t.deletedAt = t.deletedAt ?? null;
          })
      );
  }
}

export const db = new AppDatabase();

export const META_KEYS = {
  LAST_PULLED_AT: "lastPulledAt",
} as const;

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}
