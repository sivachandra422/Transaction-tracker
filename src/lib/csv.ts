import type { Transaction } from "../types";

/** Export transactions to an Excel-compatible CSV (UTF-8 BOM). */
export function exportTransactionsCsv(transactions: Transaction[]): void {
  const headers = [
    "Transaction ID",
    "Date",
    "Description",
    "Merchant",
    "Amount (INR)",
    "Type",
    "Category",
    "Labels/Tags",
    "Synced to Notion",
    "Created At",
  ];

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = transactions.map((tx) => [
    tx.id,
    tx.date,
    esc(tx.description),
    esc(tx.merchant),
    tx.amount,
    tx.type,
    tx.category,
    esc(tx.labels.join(", ")),
    tx.synced ? "Yes" : "No",
    tx.createdAt,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `FinSnap_Ledger_Export_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
