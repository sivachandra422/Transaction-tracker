import React, { useState, useEffect } from "react";
import { NotionConfig } from "../types";
import { Key, Database, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Copy, Check, BookOpen, Sparkles, FileSpreadsheet, Settings } from "lucide-react";

interface NotionSettingsProps {
  config: NotionConfig;
  onSaveConfig: (updated: NotionConfig) => void;
  onClose: () => void;
  onExportToExcel?: () => void;
}

export default function NotionSettings({ config, onSaveConfig, onClose, onExportToExcel }: NotionSettingsProps) {
  const [token, setToken] = useState(config.notionToken);
  const [databaseId, setDatabaseId] = useState(config.notionDatabaseId);
  const [autoSync, setAutoSync] = useState(config.autoSync);
  
  // Setup view mode
  const [setupMode, setSetupMode] = useState<"auto" | "manual">("auto");

  // Auto-setup states
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPages, setScannedPages] = useState<Array<{ id: string; title: string; url?: string }>>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "empty" | "error">("idle");
  const [scanMsg, setScanMsg] = useState("");

  const [isCreatingDb, setIsCreatingDb] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [createStatus, setCreateStatus] = useState<"idle" | "success" | "error">("idle");

  // Manual verify states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "success" | "error">("idle");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [dbTitle, setDbTitle] = useState(config.databaseTitle || "");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const REQUIRED_COLUMNS = [
    { name: "Name", type: "Title", desc: "Main description of the charge" },
    { name: "Amount", type: "Number", desc: "Cost/Income in numbers" },
    { name: "Category", type: "Select", desc: "Tags like Food, Shopping" },
    { name: "Type", type: "Select", desc: "Exactly 'Expense' or 'Income'" },
    { name: "Merchant", type: "Text (Rich Text)", desc: "Store/business name" },
    { name: "Date", type: "Date", desc: "Transaction date" },
    { name: "Labels", type: "Multi-select", desc: "Custom extra tags" },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => {
      setCopiedField(null);
    }, 1500);
  };

  // Auto scanning of shared pages
  const handleScanPages = async () => {
    if (!token.trim()) {
      setScanStatus("error");
      setScanMsg("Please enter your Notion API Integration Token first.");
      return;
    }

    setIsScanning(true);
    setScanStatus("idle");
    setScanMsg("");
    setScannedPages([]);

    try {
      const res = await fetch("/api/notion/search-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notionToken: token })
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned an invalid response. Please try again.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Could not fetch available pages.");
      }

      if (data.pages && data.pages.length > 0) {
        setScannedPages(data.pages);
        setSelectedPageId(data.pages[0].id);
        setScanStatus("success");
      } else {
        setScanStatus("empty");
        setScanMsg("No shared pages detected. Ensure you've completed Step 2 below to grant access.");
      }
    } catch (err: any) {
      setScanStatus("error");
      setScanMsg(err.message || "Failed to scan workspace. Verify your Notion API token.");
    } finally {
      setIsScanning(false);
    }
  };

  // Auto create Database schema
  const handleAutoCreateDatabase = async () => {
    if (!token.trim() || !selectedPageId) {
      setCreateStatus("error");
      setCreateMsg("Token and Parent Page are required.");
      return;
    }

    setIsCreatingDb(true);
    setCreateStatus("idle");
    setCreateMsg("");

    try {
      const res = await fetch("/api/notion/create-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notionToken: token,
          parentPageId: selectedPageId,
          title: "FinSnap Smart Ledger"
        })
      });

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Server communication error occurred.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to build table.");
      }

      setDatabaseId(data.databaseId);
      setDbTitle(data.title);
      setCreateStatus("success");
      setCreateMsg(`Success! Built table "FinSnap Smart Ledger"! Your tracker is fully connected.`);
      setAutoSync(true);

      // Save directly
      onSaveConfig({
        notionToken: token,
        notionDatabaseId: data.databaseId,
        autoSync: true,
        databaseTitle: data.title
      });

    } catch (err: any) {
      setCreateStatus("error");
      setCreateMsg(err.message || "Database creation failed.");
    } finally {
      setIsCreatingDb(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !databaseId.trim()) {
      setVerifyStatus("error");
      setVerifyMsg("Please enter both Token and Database ID first.");
      return;
    }

    setIsVerifying(true);
    setVerifyStatus("idle");
    setVerifyMsg("");

    try {
      const res = await fetch("/api/notion/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notionToken: token, notionDatabaseId: databaseId })
      });

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned an unexpected response (status code: ${res.status}). This may happen during server updates. Please retry in a few seconds.`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Connection test failed.");
      }

      setVerifyStatus("success");
      setDbTitle(data.title || "My Notion Tracker");
      setVerifyMsg(`Successfully connected! Database title is "${data.title || "Notion Tracker"}"`);
      setAutoSync(true);
      
      // Save directly
      onSaveConfig({
        notionToken: token,
        notionDatabaseId: databaseId,
        autoSync: true,
        databaseTitle: data.title
      });
    } catch (err: any) {
      setVerifyStatus("error");
      setVerifyMsg(err.message || "Could not link. Double check your settings.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      notionToken: token,
      notionDatabaseId: databaseId,
      autoSync,
      databaseTitle: dbTitle
    });
    onClose();
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-[#0b121f] text-slate-800 dark:text-slate-100 flex flex-col p-4 transition-colors">
      {/* Notion linking header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-105 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 p-2 rounded-xl bg-amber-100">
            <Database className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Notion Workspace Sync</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Real-time ledger and cloud backups</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-slate-600 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white px-3 py-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg border border-transparent dark:border-slate-800 transition-colors font-semibold cursor-pointer"
        >
          Back
        </button>
      </div>

      {/* SETUP SELECTION TABS */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl mb-3">
        <button
          type="button"
          onClick={() => setSetupMode("auto")}
          className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            setupMode === "auto" 
              ? "bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-400 shadow-xs" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Auto-Create DB
        </button>
        <button
          type="button"
          onClick={() => setSetupMode("manual")}
          className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            setupMode === "manual" 
              ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Settings className="w-3.5 h-3.5" /> Manual / Verify
        </button>
      </div>

      {/* AUTO SETUP MODE VIEW */}
      {setupMode === "auto" && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 space-y-3 transition-colors">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Key className="w-3 h-3 text-slate-400" /> Notion Integration Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pasted internal_integration_token..."
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 font-mono transition-all"
              />
            </div>

            <div className="py-1 flex gap-2">
              <button
                type="button"
                onClick={handleScanPages}
                disabled={isScanning || !token.trim()}
                className="flex-1 bg-slate-800 dark:bg-slate-950 hover:bg-slate-950 dark:hover:bg-slate-900 border dark:border-slate-800 text-white font-extrabold rounded-xl text-[11px] py-2 transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-40 select-none cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Scanning Workspace...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Scan Connected Pages
                  </>
                )}
              </button>
            </div>

            {/* Scan Results dropdown */}
            {scannedPages.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-dashed border-slate-100 dark:border-slate-800 animation-fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Parent Page for Database
                  </label>
                  <select
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 dark:text-slate-150"
                  >
                    {scannedPages.map((p) => (
                      <option key={p.id} value={p.id} className="dark:bg-slate-900">
                        📄 {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAutoCreateDatabase}
                  disabled={isCreatingDb}
                  className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold rounded-xl text-[11px] py-2.5 transition-all shadow-xs flex items-center justify-center gap-1.5 select-none cursor-pointer"
                >
                  {isCreatingDb ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Creating Table & Keys...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      🔨 Build Ledger Database Automatically
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Scan Status banner */}
            {scanStatus === "error" && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-2 text-rose-800 dark:text-rose-300 text-[11px] leading-relaxed font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p>{scanMsg}</p>
              </div>
            )}

            {scanStatus === "empty" && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed font-semibold animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>{scanMsg}</p>
              </div>
            )}

            {/* Database creation banners */}
            {createStatus === "success" && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-start gap-2 text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed font-semibold animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>{createMsg}</p>
              </div>
            )}

            {createStatus === "error" && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-2 text-rose-850 dark:text-rose-300 text-[11px] leading-relaxed font-semibold animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p>{createMsg}</p>
              </div>
            )}
          </div>

          {/* SIMPLIFIED INSTRUCTIONS CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 space-y-2.5 transition-colors">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 py-1 px-2.5 rounded-lg w-max">
              <BookOpen className="w-3.5 h-3.5" /> Fast Setup Instructions
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              <li>
                Visit <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="text-amber-600 dark:text-amber-400 font-extrabold hover:underline inline-flex items-center gap-0.5">Notion Integrations Hub <ExternalLink className="w-2.5 h-2.5" /></a>, create a new integration and copy the secret token. Paste it above.
              </li>
              <li>
                Open the Notion page you want to use. Click the <strong className="text-slate-800 dark:text-slate-200">...</strong> in the top-right, choose <strong className="text-slate-800 dark:text-slate-200">Add connections</strong>, find your integration's name, and add it.
              </li>
              <li>
                Click <strong className="text-slate-800 dark:text-slate-200">"Scan Connected Pages"</strong> above, choose your page, and build your fully automated tracker ledger!
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* MANUAL/VERIFY MODE VIEW */}
      {setupMode === "manual" && (
        <form onSubmit={handleVerify} className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 transition-colors">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Key className="w-3 h-3 text-slate-400" /> API Integration Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="secret_xxxxxxxxx"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 font-mono transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-400" /> Notion Database ID
            </label>
            <input
              type="text"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              placeholder="e.g. 5d120a10dfabcf33909772ee"
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 font-mono transition-all"
              required
            />
          </div>

          <div className="flex gap-2 pt-1 border-t border-dashed border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isVerifying}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl text-xs py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-55"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Test & Link DB
                </>
              )}
            </button>
            
            {databaseId.trim() && (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-205 dark:hover:bg-slate-705 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer border dark:border-slate-700"
              >
                Save Setting
              </button>
            )}
          </div>

          {verifyStatus === "success" && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-start gap-2 text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed font-semibold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p>{verifyMsg}</p>
            </div>
          )}
          {verifyStatus === "error" && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-2 text-rose-800 dark:text-rose-300 text-[11px] leading-relaxed font-semibold animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p>{verifyMsg}</p>
            </div>
          )}

          {/* Table Schema columns list */}
          <div className="pt-2">
            <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              Required Columns (Casing Sensitive)
            </h4>
            <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden text-[10px] transition-colors">
              <div className="bg-slate-55 px-2 py-1 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-extrabold uppercase text-[9px] tracking-wider grid grid-cols-12">
                <span className="col-span-5">Name</span>
                <span className="col-span-4">Type</span>
                <span className="col-span-3 text-right">Copy</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {REQUIRED_COLUMNS.map((col) => (
                  <div key={col.name} className="px-2 py-1 grid grid-cols-12 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <span className="col-span-5 font-mono text-slate-800 dark:text-slate-200">{col.name}</span>
                    <span className="col-span-4 text-slate-500 dark:text-slate-400">{col.type}</span>
                    <span className="col-span-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopy(col.name, col.name)}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        {copiedField === col.name ? <Check className="w-3 h-3 text-emerald-500 inline" /> : <Copy className="w-3 h-3 inline" />}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* AUTO SYNC SWITCH */}
      {(token.trim() || databaseId.trim()) && (
        <div className="mt-3 bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 flex items-center justify-between transition-colors">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-850 dark:text-slate-200">Instant Sync to Cloud Ledger</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Instantly append after matching</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const updatedStatus = !autoSync;
              setAutoSync(updatedStatus);
              // Store instantly
              onSaveConfig({
                notionToken: token,
                notionDatabaseId: databaseId,
                autoSync: updatedStatus,
                databaseTitle: dbTitle
              });
            }}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
              autoSync ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-800"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                autoSync ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      )}

      {/* EXCEL FALLBACK DOWNLOAD MODULE */}
      <div className="mt-4 bg-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800/80 space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">Local Excel / CSV Fallback</h4>
            <p className="text-[10px] text-slate-350 leading-relaxed mt-0.5">
              Notion is optional! You can instantly export all your logged transactions as a professionally formatted Excel spreadsheet (.csv) anytime.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onExportToExcel}
          className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm border border-emerald-400/20 cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
          Download Excel Spreadsheet (.csv)
        </button>
      </div>
    </div>
  );
}
