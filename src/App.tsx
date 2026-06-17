import React, { Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Cpu, Database, LogOut, CloudOff, RefreshCw } from "lucide-react";
import AndroidFrame from "./components/AndroidFrame";
import BottomNav from "./components/BottomNav";
import NotionSettings from "./components/NotionSettings";
import AiSettings from "./components/AiSettings";
import AuthScreen, { type AuthStep } from "./features/auth/AuthScreen";
import DashboardScreen from "./features/dashboard/DashboardScreen";
import TransactionFormScreen from "./features/transactions/TransactionFormScreen";
import RulesScreen from "./features/rules/RulesScreen";
const AnalyticsScreen = lazy(() => import("./features/analytics/AnalyticsScreen"));
import type { TabId } from "./types";
import { useSettingsStore } from "./store/settingsStore";
import { useTransactionStore } from "./store/transactionStore";
import { useTxFormStore } from "./store/txFormStore";
import { sbSignOut, sbOnAuthChange } from "./services/supabase";
import { startBackgroundSync, onSyncStatus, type SyncStatus } from "./services/syncEngine";
import { initSecureStorage } from "./services/secureStorage";
import { exportTransactionsCsv } from "./lib/csv";

export default function App() {
  const {
    currentUser, setCurrentUser, logOut,
    notionConfig, setNotionConfig,
    llmConfig, setLlmConfig,
  } = useSettingsStore();
  const { transactions, hydrated, init, rehydrate } = useTransactionStore();
  const resetForm = useTxFormStore((s) => s.reset);
  const editingTxId = useTxFormStore((s) => s.editingTxId);

  const [authStep, setAuthStep] = useState<AuthStep>("welcome");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle", lastSyncedAt: null });

  // Boot: secure storage → IndexedDB hydration
  useEffect(() => {
    initSecureStorage()
      .then(() => init())
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supabase session restore + auth change listener
  useEffect(() => {
    const unsub = sbOnAuthChange((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        logOut();
        setAuthStep("welcome");
        setActiveTab("dashboard");
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background cloud sync while signed in
  useEffect(() => {
    if (!currentUser) return;
    const stopSync = startBackgroundSync(() => void rehydrate());
    const stopStatus = onSyncStatus(setSyncStatus);
    return () => {
      stopSync();
      stopStatus();
    };
  }, [currentUser, rehydrate]);

  const handleLogOut = async () => {
    await sbSignOut();
    logOut();
    setAuthStep("welcome");
    setActiveTab("dashboard");
  };

  const navigate = (tab: TabId) => {
    if (tab === "add" && !editingTxId) resetForm();
    setActiveTab(tab);
  };

  const title = currentUser
    ? "FinSnap Ledger"
    : authStep === "signup"
      ? "Create Account"
      : authStep === "signin"
        ? "Sign In"
        : "FinSnap Ledger";

  if (!hydrated) {
    return (
      <AndroidFrame title="FinSnap Ledger" theme="dark">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#0b121f]">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading your ledger…</p>
        </div>
      </AndroidFrame>
    );
  }

  return (
    <AndroidFrame
      title={title}
      theme="dark"
      showBack={currentUser ? activeTab !== "dashboard" : authStep !== "welcome"}
      onBack={() => {
        if (!currentUser) {
          setAuthStep("welcome");
        } else {
          setActiveTab("dashboard");
        }
      }}
      actions={
        currentUser ? (
          <div className="flex items-center gap-1.5">
            {/* Cloud sync indicator */}
            <span
              title={
                syncStatus.state === "error"
                  ? `Sync error: ${syncStatus.error}`
                  : syncStatus.state === "offline"
                    ? "Offline — changes saved locally"
                    : syncStatus.lastSyncedAt
                      ? `Synced ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}`
                      : "Cloud sync"
              }
              className="p-1.5 flex items-center"
            >
              {syncStatus.state === "syncing" ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              ) : syncStatus.state === "offline" || syncStatus.state === "error" ? (
                <CloudOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </span>

            <button
              onClick={() => navigate(activeTab === "ai" ? "dashboard" : "ai")}
              className={`text-[10px] font-bold px-2 py-1 border rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === "ai"
                  ? "bg-indigo-600/35 border-indigo-500 text-indigo-300"
                  : "bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white"
              }`}
            >
              <Cpu className="w-3 h-3 text-indigo-400" />
              {llmConfig.provider === "gemini"
                ? llmConfig.hasServerApiKey ? "My Gemini" : "Gemini"
                : llmConfig.provider === "openrouter" ? "OpenRouter" : "OpenAI"}
            </button>

            {notionConfig.databaseTitle ? (
              <button
                onClick={() => navigate("notion")}
                className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer hover:bg-emerald-500/25"
              >
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Notion
              </button>
            ) : (
              <button
                onClick={() => navigate("notion")}
                className="text-amber-400 font-semibold text-[10px] px-2 py-1 border border-amber-400/30 rounded-full hover:bg-amber-400/10 cursor-pointer flex items-center gap-1"
              >
                <Database className="w-3 h-3" /> Connect
              </button>
            )}

            <button
              onClick={handleLogOut}
              title="Log out"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null
      }
      bottomNav={
        currentUser ? <BottomNav activeTab={activeTab} onTabChange={navigate} /> : null
      }
    >
      {!currentUser ? (
        <AuthScreen step={authStep} onStepChange={setAuthStep} />
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <DashboardScreen key="dashboard" onNavigate={navigate} />
          )}
          {activeTab === "add" && (
            <TransactionFormScreen
              key="add"
              onDone={() => setActiveTab("dashboard")}
              onNeedNotionConfig={() => setActiveTab("notion")}
            />
          )}
          {activeTab === "rules" && <RulesScreen key="rules" />}
          {activeTab === "charts" && (
            <Suspense
              key="charts"
              fallback={
                <div className="flex-1 flex items-center justify-center bg-[#0b121f]">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <AnalyticsScreen />
            </Suspense>
          )}
          {activeTab === "notion" && (
            <NotionSettings
              key="notion"
              config={notionConfig}
              onSaveConfig={setNotionConfig}
              onClose={() => setActiveTab("dashboard")}
              onExportToExcel={() => exportTransactionsCsv(transactions)}
            />
          )}
          {activeTab === "ai" && (
            <AiSettings
              key="ai"
              config={llmConfig}
              onSaveConfig={setLlmConfig}
              onClose={() => setActiveTab("dashboard")}
            />
          )}
        </AnimatePresence>
      )}
    </AndroidFrame>
  );
}
