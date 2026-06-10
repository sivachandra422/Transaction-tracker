import React from "react";
import { Building2, Calendar, Tag, Database } from "lucide-react";
import { Transaction } from "../types";
import { CATEGORY_COLORS } from "../constants";

type SyncStatus = "idle" | "pending" | "success" | "error";

interface TransactionRowProps {
  tx: Transaction;
  syncStatus: SyncStatus;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onSync: (tx: Transaction) => void;
}

const TransactionRow = React.memo(function TransactionRow({
  tx,
  syncStatus,
  onEdit,
  onDelete,
  onSync,
}: TransactionRowProps) {
  return (
    <div
      id={`transaction-item-${tx.id}`}
      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 shadow-xs hover:shadow-sm hover:border-slate-205 dark:hover:border-slate-700 transition-all flex items-center justify-between"
    >
      <div className="flex items-center gap-3 truncate max-w-[70%]">
        <div
          className="p-3 rounded-xl text-white font-bold text-center flex-shrink-0"
          style={{ backgroundColor: CATEGORY_COLORS[tx.category] || "#475569" }}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider block">
            {tx.category.substring(0, 3)}
          </span>
        </div>

        <div className="truncate">
          <div className="flex items-center gap-1 px-0.5">
            <h4
              className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate"
              title={tx.description}
            >
              {tx.description}
            </h4>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            <span className="flex items-center gap-0.5 max-w-[100px] truncate">
              <Building2 className="w-2.5 h-2.5" /> {tx.merchant}
            </span>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <Calendar className="w-2.5 h-2.5" /> {tx.date}
            </span>
          </div>

          {tx.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tx.labels.map((l, index) => (
                <span
                  key={`${l}-${index}`}
                  className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-md text-[9px] lowercase flex items-center gap-0.5"
                >
                  <Tag className="w-2 h-2 text-slate-400 dark:text-slate-500" /> {l}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0 space-y-1.5 pl-2">
        <div className="font-mono font-extrabold text-[13px]">
          <span
            className={
              tx.type === "expense"
                ? "text-slate-800 dark:text-slate-100"
                : "text-emerald-600 dark:text-emerald-400"
            }
          >
            {tx.type === "expense" ? "-" : "+"}₹
            {tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            title="Edit transaction details"
            onClick={() => onEdit(tx)}
            id={`btn-edit-tx-${tx.id}`}
            className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 py-2 px-2.5 rounded-lg min-h-[36px] flex items-center cursor-pointer"
          >
            Edit
          </button>

          <button
            title="Delete record locally"
            onClick={() => onDelete(tx.id)}
            id={`btn-delete-tx-${tx.id}`}
            className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 py-2 px-2.5 rounded-lg min-h-[36px] flex items-center cursor-pointer"
          >
            Delete
          </button>

          <button
            onClick={() => onSync(tx)}
            title={tx.synced ? "Synced to Notion Database" : "Sync directly to Notion now"}
            id={`btn-sync-tx-${tx.id}`}
            className={`flex items-center gap-1 text-[11px] font-bold px-2 py-2 min-h-[36px] rounded-lg border cursor-pointer transition-all ${
              syncStatus === "success"
                ? "bg-slate-900 dark:bg-slate-950 border-slate-900 dark:border-slate-800 text-amber-400 dark:text-amber-400 hover:bg-slate-850 dark:hover:bg-slate-905"
                : syncStatus === "pending"
                  ? "bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 uppercase animate-pulse"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-350"
            }`}
          >
            <Database className="w-2.5 h-2.5 text-amber-500" />
            <span>
              {syncStatus === "success" ? "Synced" : syncStatus === "pending" ? "Saving" : "Sync"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default TransactionRow;
