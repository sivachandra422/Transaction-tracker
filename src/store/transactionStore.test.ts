import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../constants";
import type { Transaction } from "../types";
import { useTransactionStore } from "./transactionStore";

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
    useTransactionStore.setState({ transactions: [], rules: DEFAULT_RULES });
  });

  it("starts with an empty transactions list", () => {
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it("addTransaction prepends a transaction", () => {
    const tx1 = makeTx({ id: "a", amount: 100 });
    const tx2 = makeTx({ id: "b", amount: 200 });
    useTransactionStore.getState().addTransaction(tx1);
    useTransactionStore.getState().addTransaction(tx2);
    const { transactions } = useTransactionStore.getState();
    expect(transactions).toHaveLength(2);
    expect(transactions[0].id).toBe("b"); // newest first
  });

  it("deleteTransaction removes by id", () => {
    useTransactionStore.getState().addTransaction(makeTx({ id: "del-me" }));
    useTransactionStore.getState().deleteTransaction("del-me");
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it("updateTransaction replaces the matching record", () => {
    useTransactionStore.getState().addTransaction(makeTx({ id: "upd", amount: 100 }));
    useTransactionStore.getState().updateTransaction(makeTx({ id: "upd", amount: 999 }));
    expect(useTransactionStore.getState().transactions[0].amount).toBe(999);
  });

  it("clearTransactions empties the list", () => {
    useTransactionStore.getState().addTransaction(makeTx());
    useTransactionStore.getState().clearTransactions();
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it("markSynced sets synced flag and notionPageId", () => {
    useTransactionStore.getState().addTransaction(makeTx({ id: "sync-me" }));
    useTransactionStore.getState().markSynced("sync-me", "notion-abc", "https://notion.so/abc");
    const tx = useTransactionStore.getState().transactions[0];
    expect(tx.synced).toBe(true);
    expect(tx.notionPageId).toBe("notion-abc");
    expect(tx.notionUrl).toBe("https://notion.so/abc");
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
