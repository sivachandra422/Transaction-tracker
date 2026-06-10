import Dexie, { type Table } from "dexie";
import type { Transaction } from "../types";

class AppDatabase extends Dexie {
  transactions!: Table<Transaction, string>;

  constructor() {
    super("finsnap_ledger_v1");
    this.version(1).stores({
      // Primary key is id; additional indexed fields for fast queries
      transactions: "id, date, category, type, synced, createdAt",
    });
  }
}

export const db = new AppDatabase();
