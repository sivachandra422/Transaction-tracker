import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RULES } from "../constants";
import type { Transaction } from "../types";
import { useTransactionStore } from "./transactionStore";

// Mock Dexie db so tests run without a real IndexedDB engine
vi.mock("../services/db", () => ({
  db: {
    transactions: {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      orderBy: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
  },
}));

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "tx-test-1",
  date: "2025-06-10",
  description: "Lunch at Swiggy",
  merchant: "Swiggy",
  amount: 350,
  type: "expense" as const,
  category: "Food" as const,
  labels: ["lunch"],
  synced: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("transactionStore", () => {
  beforeEach(() => {
    useTransactionStore.setState({ transactions: [], rules: DEFAULT_RULES, hydrated: false });
  });

  it("starts with empty transactions and hydrated=false", () => {
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
    expect(useTransactionStore.getState().hydrated).toBe(false);
  });

  it("init() loads records from Dexie and sets hydrated=true", async () => {
    const { db } = await import("../services/db");
    const mockTx = makeTx({ id: "from-db" });
    vi.mocked(db.transactions.orderBy("createdAt").reverse().toArray).mockResolvedValueOnce([mockTx]);

    await useTransactionStore.getState().init();
    const state = useTransactionStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.transactions[0].id).toBe("from-db");
  });

  it("addTransaction prepends a transaction and writes to Dexie", async () => {
    const { db } = await import("../services/db");
    const tx1 = makeTx({ id: "a", amount: 100 });
    const tx2 = makeTx({ id: "b", amount: 200 });
    useTransactionStore.getState().addTransaction(tx1);
    useTransactionStore.getState().addTransaction(tx2);
    const { transactions } = useTransactionStore.getState();
    expect(transactions).toHaveLength(2);
    expect(transactions[0].id).toBe("b"); // newest first
    expect(db.transactions.put).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
  });

  it("deleteTransaction removes by id and calls Dexie delete", async () => {
    const { db } = await import("../services/db");
    useTransactionStore.getState().addTransaction(makeTx({ id: "del-me" }));
    useTransactionStore.getState().deleteTransaction("del-me");
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
    expect(db.transactions.delete).toHaveBeenCalledWith("del-me");
  });

  it("updateTransaction replaces the matching record", () => {
    useTransactionStore.getState().addTransaction(makeTx({ id: "upd", amount: 100 }));
    useTransactionStore.getState().updateTransaction(makeTx({ id: "upd", amount: 999 }));
    expect(useTransactionStore.getState().transactions[0].amount).toBe(999);
  });

  it("clearTransactions empties the list and calls Dexie clear", async () => {
    const { db } = await import("../services/db");
    useTransactionStore.getState().addTransaction(makeTx());
    useTransactionStore.getState().clearTransactions();
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
    expect(db.transactions.clear).toHaveBeenCalled();
  });

  it("markSynced sets synced flag, notionPageId, and writes to Dexie", async () => {
    const { db } = await import("../services/db");
    useTransactionStore.getState().addTransaction(makeTx({ id: "sync-me" }));
    useTransactionStore.getState().markSynced("sync-me", "notion-abc", "https://notion.so/abc");
    const tx = useTransactionStore.getState().transactions[0];
    expect(tx.synced).toBe(true);
    expect(tx.notionPageId).toBe("notion-abc");
    expect(tx.notionUrl).toBe("https://notion.so/abc");
    expect(db.transactions.put).toHaveBeenCalledWith(expect.objectContaining({ synced: true }));
  });

  it("markSynced does not affect other transactions", () => {
    useTransactionStore.getState().addTransaction(makeTx({ id: "other" }));
    useTransactionStore.getState().addTransaction(makeTx({ id: "target" }));
    useTransactionStore.getState().markSynced("target", "pid", "url");
    const other = useTransactionStore.getState().transactions.find((t) => t.id === "other");
    expect(other?.synced).toBe(false);
  });

  it("addRule prepends a rule", () => {
    const initialCount = useTransactionStore.getState().rules.length;
    const newRule = { id: "r1", keyword: "petrol", category: "Transport" as const };
    useTransactionStore.getState().addRule(newRule);
    const { rules } = useTransactionStore.getState();
    expect(rules).toHaveLength(initialCount + 1);
    expect(rules[0].keyword).toBe("petrol");
  });

  it("deleteRule removes by id", () => {
    const newRule = { id: "r-del", keyword: "coffee", category: "Food" as const };
    useTransactionStore.getState().addRule(newRule);
    useTransactionStore.getState().deleteRule("r-del");
    const found = useTransactionStore.getState().rules.find((r) => r.id === "r-del");
    expect(found).toBeUndefined();
  });

  it("resetRules restores DEFAULT_RULES", () => {
    useTransactionStore.setState({ rules: [] });
    useTransactionStore.getState().resetRules();
    expect(useTransactionStore.getState().rules).toEqual(DEFAULT_RULES);
  });
});
