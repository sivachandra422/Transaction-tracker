import React, { useCallback, useRef, useState } from "react";
import { motion } from "motion/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Wallet, TrendingUp, TrendingDown, Search, Sparkles, FileImage,
  MessageSquare, Play, Bell, X, FileSpreadsheet, CheckCheck, Database, Inbox,
} from "lucide-react";
import type { TabId, Transaction, CategoryType } from "../../types";
import { CATEGORIES } from "../../constants";
import { useTransactionStore } from "../../store/transactionStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useSyncStore } from "../../store/syncStore";
import { useTxFormStore } from "../../store/txFormStore";
import { useNotionSync } from "../../hooks/useNotionSync";
import { useTransactionFilters } from "../../hooks/useTransactionFilters";
import { parseTransactionAi } from "../../services/aiApi";
import { exportTransactionsCsv } from "../../lib/csv";
import { formatINR, nowISO, todayISO } from "../../lib/format";
import type { DateRangePreset } from "../../lib/dateRanges";
import TransactionRow from "../../components/TransactionRow";
import { Button, Card, SegmentedControl, EmptyState, Badge, inputClass } from "../../components/ui";

const SMS_PRESETS = [
  "HDFC Bank UPI: Debited ₹420.00 from ACXX9876 on 09-Jun-2026 12:45 PM to Swiggy@axisbank Ref 616238.",
  "ICICI Bank: Rs 1,299.00 debited from a/c XX443 on 08-Jun-26 to AMAZON PAY INDIA. UPI Ref 882210.",
  "SBI UPI: Rs.85.00 debited from A/c XX221 to RAPIDO BIKE on 09Jun26. Ref no 445901.",
  "AXIS BANK: INR 15,000.00 credited to A/c XX889 on 07-Jun-26 by SALARY NEFT-JUN.",
];

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "all", label: "All" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom" },
];

interface DashboardScreenProps {
  onNavigate: (tab: TabId) => void;
}

export default function DashboardScreen({ onNavigate }: DashboardScreenProps) {
  const { transactions, addTransaction, deleteTransaction } = useTransactionStore();
  const llmConfig = useSettingsStore((s) => s.llmConfig);
  const notionConfig = useSettingsStore((s) => s.notionConfig);
  const syncLogs = useSyncStore((s) => s.syncLogs);
  const { fillFromAi, loadTransaction } = useTxFormStore();
  const { syncSingle, bulkSync, configured } = useNotionSync(() => onNavigate("notion"));

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Fast entry
  const [fastEntryMode, setFastEntryMode] = useState<"receipt" | "sms">("sms");
  const [fastEntryText, setFastEntryText] = useState("");
  const [smsText, setSmsText] = useState(SMS_PRESETS[0]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ sender: string; body: string } | null>(null);

  const { filtered, totalIncome, totalExpense, netBalance } = useTransactionFilters({
    transactions,
    searchQuery,
    categoryFilter,
    dateRangePreset,
    customStartDate,
    customEndDate,
  });

  // ─── Fast entry: receipt / free text → prefill form ────────────────────────
  const [receiptMime, setReceiptMime] = useState<string>("image/jpeg");

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptName(file.name);
    setReceiptMime(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = () => setReceiptBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAiFastEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fastEntryText.trim() && !receiptBase64) {
      setParseError("Provide a text note or receipt image to analyze.");
      return;
    }
    setIsParsing(true);
    setParseError("");
    try {
      const info = await parseTransactionAi({
        provider: llmConfig.provider,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        ...(fastEntryText.trim() && { text: fastEntryText }),
        ...(receiptBase64 && { image: receiptBase64, imageType: receiptMime }),
      });
      // An image that only produced the empty offline fallback is a failed scan —
      // show the reason instead of opening a blank form.
      if (receiptBase64 && info.isFallback && !info.amount) {
        setParseError(
          `Couldn't read the receipt${info.fallbackReason ? `: ${info.fallbackReason}` : "."} ` +
            "Check the AI provider/model in settings, or type the details as text."
        );
        return;
      }
      fillFromAi(info);
      setFastEntryText("");
      setReceiptName(null);
      setReceiptBase64(null);
      onNavigate("add");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "AI scanning error occurred.");
    } finally {
      setIsParsing(false);
    }
  };

  // ─── SMS interception simulator → auto-add transaction ─────────────────────
  const simulateSms = async () => {
    if (!smsText.trim()) {
      setParseError("Enter or pick a simulated SMS first.");
      return;
    }
    setIsParsing(true);
    setParseError("");

    let sender = "DM-HDFCBK";
    const lower = smsText.toLowerCase();
    if (lower.includes("axis")) sender = "VZ-AXISBK";
    else if (lower.includes("icici")) sender = "BP-ICICIB";
    else if (lower.includes("sbi")) sender = "JD-SBIUPI";

    setToast({ sender, body: smsText });

    try {
      const info = await parseTransactionAi({
        text: smsText,
        provider: llmConfig.provider,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
      });

      const providerTag = info.isFallback ? "Smart Match" : info.usingProvider;
      setToast({
        sender,
        body: `Detected: ₹${info.amount || 0} at ${info.merchant || "Merchant"} [${providerTag}]`,
      });

      const tx: Transaction = {
        id: `tx-sms-${Date.now()}`,
        amount: info.amount || 0,
        description: info.description || "UPI transaction",
        merchant: info.merchant || "Unknown Merchant",
        category: (info.category || "Other") as CategoryType,
        type: info.type === "income" ? "income" : "expense",
        date: info.date || todayISO(),
        labels: Array.from(
          new Set([...(info.labels || []), "sms-auto", info.isFallback ? "heuristic" : "ai"])
        ),
        synced: false,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      addTransaction(tx);

      if (configured && notionConfig.autoSync) void syncSingle(tx);
      setTimeout(() => setToast(null), 6000);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to process SMS.");
      setToast(null);
    } finally {
      setIsParsing(false);
    }
  };

  // ─── Row callbacks ──────────────────────────────────────────────────────────
  const handleEditRow = useCallback(
    (tx: Transaction) => {
      loadTransaction(tx);
      onNavigate("add");
    },
    [loadTransaction, onNavigate]
  );

  const handleDeleteRow = useCallback(
    (id: string) => {
      if (confirm("Delete this transaction? It will also be removed from cloud sync.")) {
        deleteTransaction(id);
      }
    },
    [deleteTransaction]
  );

  const handleSyncRow = useCallback(
    (tx: Transaction) => void syncSingle(tx),
    [syncSingle]
  );

  const handleBulkSync = async () => {
    const count = await bulkSync();
    if (count === 0) alert("All transactions are already synced to Notion!");
  };

  // Virtualized list
  const txListRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => txListRef.current,
    estimateSize: () => 96,
    overscan: 4,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex-1 bg-[#0b121f] text-slate-100 flex flex-col p-4 space-y-4"
    >
      {/* Incoming SMS toast */}
      {toast && (
        <div className="absolute top-2 left-2 right-2 bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-3 rounded-2xl shadow-xl z-50 border border-slate-700/50 flex gap-3">
          <div className="bg-indigo-600 p-2 h-9 w-9 flex items-center justify-center rounded-xl shrink-0 shadow-md">
            <Bell className="w-4 h-4 text-white animate-bounce" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">
                {toast.sender}
              </span>
              <span className="text-[9px] text-slate-500">just now</span>
            </div>
            <p className="text-[11px] font-bold mt-0.5 line-clamp-1">{toast.body}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">
                SMS Auto-Interception Active
              </span>
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-white shrink-0 self-start cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Wallet summary */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-5 rounded-3xl text-white shadow-xl relative overflow-hidden border border-slate-800/60">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mt-10 -mr-10" />
        <div className="flex items-center justify-between mb-1 opacity-75">
          <span className="text-[11px] uppercase tracking-wider font-bold">Net Balance (INR)</span>
          <Wallet className="w-4 h-4 text-slate-300" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight font-mono">
          ₹{formatINR(netBalance)}
        </h2>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/20 p-1.5 rounded-lg text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="opacity-75 text-[10px]">Income</p>
              <p className="font-bold font-mono text-emerald-300">₹{formatINR(totalIncome)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-rose-500/20 p-1.5 rounded-lg text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <p className="opacity-75 text-[10px]">Expenses</p>
              <p className="font-bold font-mono text-rose-300">₹{formatINR(totalExpense)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fast entry card */}
      <Card className="space-y-3">
        <SegmentedControl
          value={fastEntryMode}
          onChange={setFastEntryMode}
          options={[
            {
              value: "sms",
              label: (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> SMS Auto-Capture
                </span>
              ),
            },
            {
              value: "receipt",
              label: (
                <span className="inline-flex items-center gap-1">
                  <FileImage className="w-3 h-3" /> Receipt / Note
                </span>
              ),
            },
          ]}
        />

        {parseError && (
          <p className="text-[10.5px] text-amber-300 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
            {parseError}
          </p>
        )}

        {fastEntryMode === "sms" ? (
          <div className="space-y-2.5">
            <textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={3}
              className={`${inputClass()} resize-none leading-relaxed`}
              placeholder="Paste a bank SMS here…"
            />
            <div className="grid grid-cols-2 gap-1.5">
              {SMS_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSmsText(preset)}
                  className="text-left text-[9px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1.5 hover:border-indigo-700/60 hover:text-slate-200 transition-colors cursor-pointer line-clamp-2"
                >
                  {preset.slice(0, 64)}…
                </button>
              ))}
            </div>
            <Button full onClick={simulateSms} disabled={isParsing}>
              <Play className="w-3.5 h-3.5" />
              {isParsing ? "Intercepting…" : "Simulate SMS Interception"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleAiFastEntry} className="space-y-2.5">
            <textarea
              value={fastEntryText}
              onChange={(e) => setFastEntryText(e.target.value)}
              rows={2}
              className={`${inputClass()} resize-none`}
              placeholder='e.g. "Dinner at Truffles 850 yesterday" or attach a receipt'
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileImage className="w-3.5 h-3.5" />
                {receiptName ? receiptName.slice(0, 16) : "Attach Receipt"}
              </Button>
              <Button type="submit" className="flex-1" disabled={isParsing}>
                <Sparkles className="w-3.5 h-3.5" />
                {isParsing ? "Parsing…" : "AI Parse"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Export banner when Notion not configured */}
      {!configured && transactions.length > 0 && (
        <Card className="!p-3 border-emerald-800/40 bg-emerald-950/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-emerald-200">Export to Excel</h4>
              <p className="text-[9.5px] text-emerald-400/70 truncate">
                Notion not connected — download your ledger as CSV
              </p>
            </div>
          </div>
          <Button
            variant="success"
            className="!py-2 shrink-0"
            onClick={() => exportTransactionsCsv(transactions)}
          >
            Download
          </Button>
        </Card>
      )}

      {/* History header + filters */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">
            Transactions <span className="text-slate-500 font-mono">({filtered.length})</span>
          </h3>
          {configured && (
            <Button variant="secondary" className="!py-1.5 !px-3" onClick={handleBulkSync}>
              <CheckCheck className="w-3 h-3" /> Sync All
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search description, merchant, tag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={inputClass(true)}
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDateRangePreset(p.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                dateRangePreset === p.value
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {dateRangePreset === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className={inputClass()}
            />
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className={inputClass()}
            />
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? "bg-slate-100 border-slate-100 text-slate-900"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Virtualized list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={transactions.length === 0 ? "No transactions yet" : "No matches"}
          subtitle={
            transactions.length === 0
              ? "Simulate an SMS above or tap + to add your first transaction."
              : "Try adjusting your search or filters."
          }
        />
      ) : (
        <div ref={txListRef} className="flex-1 min-h-[200px] overflow-y-auto -mx-1 px-1">
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
          >
            {virtualizer.getVirtualItems().map((vItem) => {
              const tx = filtered[vItem.index];
              return (
                <div
                  key={tx.id}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vItem.start}px)`,
                    paddingBottom: 10,
                  }}
                >
                  <TransactionRow
                    tx={tx}
                    syncStatus={
                      tx.synced ? "success" : (syncLogs[tx.id]?.status ?? "idle")
                    }
                    onEdit={handleEditRow}
                    onDelete={handleDeleteRow}
                    onSync={handleSyncRow}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notion status hint */}
      {!configured && (
        <button
          onClick={() => onNavigate("notion")}
          className="self-center cursor-pointer"
          title="Connect Notion"
        >
          <Badge tone="amber">
            <Database className="w-2.5 h-2.5" /> Connect Notion to enable live sync
          </Badge>
        </button>
      )}
    </motion.div>
  );
}
