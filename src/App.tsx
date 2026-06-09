import React, { useState, useEffect, useRef } from "react";
import AndroidFrame from "./components/AndroidFrame";
import NotionSettings from "./components/NotionSettings";
import AiSettings from "./components/AiSettings";
import { Transaction, CategoryType } from "./types";
import { useTransactionStore } from "./store/transactionStore";
import { useSettingsStore } from "./store/settingsStore";
import { useSyncStore } from "./store/syncStore";
import { parseTransactionAi } from "./services/aiApi";
import { syncToNotion } from "./services/notionApi";
import { CATEGORIES, CATEGORY_COLORS, DEFAULT_HEURISTICS } from "./constants";
import { 
  Plus, Settings, Home, PlusCircle, Database, Trash2, Check, CheckCircle2, 
  AlertTriangle, RefreshCw, FileText, Sparkles, List, ArrowRight, Search, 
  Building2, Calendar, Tag, Undo, CheckCheck, FileImage, X, DollarSign,
  TrendingDown, TrendingUp, Wallet, PieChart as PieIcon, Sliders, Play,
  Bell, Info, Smartphone, MessageSquare, Copy, FileSpreadsheet, Cpu,
  Sun, Moon, User, Lock, Mail, LogOut, ShieldAlert
} from "lucide-react";
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line 
} from "recharts";


export default function App() {
  // ─── Global stores ─────────────────────────────────────────────────────────
  const {
    theme, setTheme,
    currentUser, setCurrentUser, logOut,
    notionConfig, setNotionConfig,
    llmConfig, setLlmConfig,
  } = useSettingsStore();

  const {
    transactions, rules,
    addTransaction, updateTransaction, deleteTransaction, clearTransactions,
    markSynced, addRule, deleteRule, resetRules,
  } = useTransactionStore();

  const { syncLogs, setSyncPending, setSyncSuccess, setSyncError } = useSyncStore();

  // ─── Local UI state ─────────────────────────────────────────────────────────
  const [onboardingStep, setOnboardingStep] = useState<"welcome" | "signup" | "signin">("welcome");
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", agreed: true });
  const [signinForm, setSigninForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");

  // ─── Navigation ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"dashboard" | "add" | "rules" | "charts" | "notion" | "ai">("dashboard");

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    
    if (!signupForm.name.trim() || !signupForm.email.trim() || !signupForm.password.trim()) {
      setAuthError("Please fill out all fields.");
      return;
    }
    
    if (signupForm.password.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }

    if (!signupForm.email.includes("@")) {
      setAuthError("Please specify a valid email address.");
      return;
    }

    const userData = { email: signupForm.email.trim(), name: signupForm.name.trim() };
    setCurrentUser(userData);
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!signinForm.email.trim() || !signinForm.password.trim()) {
      setAuthError("Please fill out all fields.");
      return;
    }

    if (signinForm.password.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }

    const name = signinForm.email.split("@")[0];
    const userData = { email: signinForm.email.trim(), name: name.charAt(0).toUpperCase() + name.slice(1) };
    setCurrentUser(userData);
  };

  const handleLogOut = () => {
    logOut();
    setOnboardingStep("welcome");
    setActiveTab("dashboard");
  };

  // UI / Interaction States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  
  // Date Range Filter States
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "week" | "month" | "last_month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Helper to resolve effective date limits for the active period
  const getDateRangeLimits = () => {
    const now = new Date(); // The current device date

    switch (dateRangePreset) {
      case "week": {
        // Current week (starting on Monday)
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      }
      case "month": {
        // Current calendar month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      }
      case "last_month": {
        // Last calendar month
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start: startOfLastMonth, end: endOfLastMonth };
      }
      case "custom": {
        const start = customStartDate ? new Date(customStartDate + "T00:00:00") : null;
        const end = customEndDate ? new Date(customEndDate + "T23:59:59") : null;
        return { start, end };
      }
      case "all":
      default:
        return { start: null, end: null };
    }
  };
  
  // New Transaction Form State
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txMerchant, setTxMerchant] = useState("");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [txCategory, setTxCategory] = useState<CategoryType>("Other");
  const [txLabels, setTxLabels] = useState("");
  
  // Suggested Categorization State
  const [localSuggestedCategory, setLocalSuggestedCategory] = useState<CategoryType | null>(null);
  const [suggestionTrigger, setSuggestionTrigger] = useState<string>("");
  const [hasUserManuallySetCategory, setHasUserManuallySetCategory] = useState(false);

  // AI OCR / Fast Entry States
  const [fastEntryText, setFastEntryText] = useState("");
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiParseError, setAiParseError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptImageName, setReceiptImageName] = useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);

  // Indian Bank UPI / SMS Interception Simulator States
  const [fastEntryMode, setFastEntryMode] = useState<"receipt" | "sms">("sms"); // Default to sms since user wants to know about automation simulation
  const [simulatedSmsText, setSimulatedSmsText] = useState("HDFC Bank UPI: Debited ₹420.00 from ACXX9876 on 09-Jun-2026 12:45 PM to Swiggy@axisbank Ref 616238.");
  const [activeIncomingToast, setActiveIncomingToast] = useState<{ sender: string; body: string; isLive: boolean } | null>(null);


  // Editing transaction state (if editing existing)
  const [editingTxId, setEditingTxId] = useState<string | null>(null);


  // Custom User Rules addition state
  const [newRuleKeyword, setNewRuleKeyword] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState<CategoryType>("Food");

  // Automatic Categorization Hook
  // Suggest category based on description & merchant changes
  useEffect(() => {
    if (hasUserManuallySetCategory) return; // Respect manual selection ceiling

    const searchStr = `${txDescription} ${txMerchant}`.toLowerCase().trim();
    if (!searchStr) {
      setLocalSuggestedCategory(null);
      setSuggestionTrigger("");
      return;
    }

    // 1. Check user-defined custom rules
    const matchedRule = rules.find(rule => 
      rule.keyword && searchStr.includes(rule.keyword.toLowerCase())
    );

    if (matchedRule) {
      setLocalSuggestedCategory(matchedRule.category);
      setSuggestionTrigger(`Rule keyword: "${matchedRule.keyword}"`);
      return;
    }

    // 2. Check default system fallback heuristics
    for (const group of DEFAULT_HEURISTICS) {
      for (const kw of group.keywords) {
        if (searchStr.includes(kw)) {
          setLocalSuggestedCategory(group.category);
          setSuggestionTrigger(`Keyword trigger: "${kw}"`);
          return;
        }
      }
    }

    // No suggestions triggered
    setLocalSuggestedCategory(null);
    setSuggestionTrigger("");
  }, [txDescription, txMerchant, rules, hasUserManuallySetCategory]);

  // Synchronously update form category field when a local suggestion triggers,
  // EXCEPT we let the user manually confirm, OR automatically assign but warn.
  // The guideline says: "Provide a way for the user to confirm or change these suggested categories."
  // So we will display a prominent suggestion card in the UI rather than silently forcing it.
  
  const applySuggestedCategory = () => {
    if (localSuggestedCategory) {
      setTxCategory(localSuggestedCategory);
      setHasUserManuallySetCategory(true); // Treat as custom-set now
      setLocalSuggestedCategory(null); // Clear suggestion banner since applied
    }
  };

  // Parse receipts or voice inputs using server-side Gemini 3.5 Flash
  const handleAiFastEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fastEntryText.trim() && !receiptBase64) {
      setAiParseError("Please provide a text command, note, or receipt image to analyze.");
      return;
    }

    setIsAiParsing(true);
    setAiParseError("");

    try {
      const info = await parseTransactionAi({
        provider: llmConfig.provider,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        ...(fastEntryText.trim() && { text: fastEntryText }),
        ...(receiptBase64 && { image: receiptBase64, imageType: "image/jpeg" }),
      });

      // Auto-fill form and display transaction creator
      setTxType(info.type === "income" ? "income" : "expense");
      setTxAmount(String(info.amount || ""));
      setTxDescription(info.description || "");
      setTxMerchant(info.merchant || "");
      setTxDate(info.date || new Date().toISOString().split('T')[0]);
      
      // The AI extracts a recommended category. We display a recommendation confirmation notice.
      // We populate it in the dropdown but show the "🤖 Gemini suggested: [Category]" so they can change it.
      setTxCategory((info.category || "Other") as CategoryType);
      setHasUserManuallySetCategory(false); // Enable suggestions notice if they tweak it
      
      if (info.labels && Array.isArray(info.labels)) {
        setTxLabels(info.labels.join(", "));
      } else {
        setTxLabels("");
      }

      if (info.isFallback) {
        setAiParseError("⚡ Gemini is busy, but our smart local parsing engine instantly decoded your transaction! Confirm and save below.");
      } else {
        setAiParseError("");
      }

      // Display the form tab for confirmation
      setActiveTab("add");
      
      // Clean fast-entry box
      setFastEntryText("");
      setReceiptImageName(null);
      setReceiptBase64(null);

    } catch (err: any) {
      console.error(err);
      setAiParseError(err.message || "An AI scanning error occurred.");
    } finally {
      setIsAiParsing(false);
    }
  };

  // Handle receipt image files
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptImageName(file.name);
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReceiptBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const triggerMockUpload = (exampleText: string) => {
    setFastEntryText(exampleText);
  };

  // Simulated background SMS scanner triggering automated entry
  const simulateSmsIntercept = async (customText?: string) => {
    const textToParse = customText || simulatedSmsText;
    if (!textToParse.trim()) {
      setAiParseError("Please enter or select a simulated SMS text message first.");
      return;
    }

    setIsAiParsing(true);
    setAiParseError("");
    
    // Determine simulated Sender Name
    let senderName = "DM-HDFCBK";
    if (textToParse.toLowerCase().includes("axis")) senderName = "VZ-AXISBK";
    else if (textToParse.toLowerCase().includes("icici")) senderName = "BP-ICICIB";
    else if (textToParse.toLowerCase().includes("sbi")) senderName = "JD-SBIUPI";
    else if (textToParse.toLowerCase().includes("airtel")) senderName = "AD-ATLPAY";

    setActiveIncomingToast({
      sender: senderName,
      body: textToParse,
      isLive: true
    });

    try {
      const info = await parseTransactionAi({
        text: textToParse,
        provider: llmConfig.provider,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
      });

      // Update active toast to denote model interception type
      setActiveIncomingToast(prev => {
        if (!prev) return null;
        const providerTag = info.isFallback 
          ? "Smart Match" 
          : info.usingProvider === "openrouter" 
            ? "OpenRouter" 
            : info.usingProvider === "openai" 
              ? "OpenAI" 
              : "Gemini";
        return {
          ...prev,
          body: `Detected: ₹${info.amount || 0} at ${info.merchant || "Merchant"} [${providerTag}]`
        };
      });

      // Formulate transaction object representing automated background entry
      const simulatedTx: Transaction = {
        id: `tx-simulated-${Date.now()}`,
        amount: info.amount || 0,
        description: info.description || "Simulated UPI Outgo",
        merchant: info.merchant || "Unknown Merchant",
        category: (info.category || "Other") as CategoryType,
        type: (info.type === "income" ? "income" : "expense") as "expense" | "income",
        date: info.date || new Date().toISOString().split('T')[0],
        labels: Array.from(new Set([...(info.labels || []), "sms-auto", "simulated", info.isFallback ? "heuristic" : "gemini"])) as string[],
        synced: false,
        createdAt: new Date().toISOString()
      };

      // Add to transactions list
      addTransaction(simulatedTx);

      // Trigger automatic sync to Notion if auto-sync is on
      if (notionConfig.notionToken && notionConfig.notionDatabaseId && notionConfig.autoSync) {
        syncSingleToNotion(simulatedTx);
      }

      // Auto-clear active pop-up notification after 6 seconds
      setTimeout(() => {
        setActiveIncomingToast(null);
      }, 6000);

    } catch (err: any) {
      console.error(err);
      setAiParseError(err.message || "Failed to automatically process transaction from SMS.");
      setActiveIncomingToast(null);
    } finally {
      setIsAiParsing(false);
    }
  };


  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleKeyword.trim()) return;
    addRule({
      id: `rule-${Date.now()}`,
      keyword: newRuleKeyword.trim().toLowerCase(),
      category: newRuleCategory,
    });
    setNewRuleKeyword("");
  };

  const handleDeleteRule = (id: string) => {
    deleteRule(id);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(txAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid numeric amount.");
      return;
    }

    const processedLabels = Array.from(new Set(
      txLabels
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0)
    )) as string[];

    const transactionData: Transaction = {
      id: editingTxId || `tx-${Date.now()}`,
      amount: amountVal,
      description: txDescription.trim() || `${txCategory} item`,
      merchant: txMerchant.trim() || "Unspecified",
      category: txCategory,
      type: txType,
      date: txDate,
      labels: processedLabels,
      synced: editingTxId ? transactions.find(t => t.id === editingTxId)?.synced || false : false,
      createdAt: editingTxId ? transactions.find(t => t.id === editingTxId)?.createdAt || new Date().toISOString() : new Date().toISOString()
    };

    if (editingTxId) {
      updateTransaction(transactionData);
      setEditingTxId(null);
    } else {
      addTransaction(transactionData);
    }

    // AutoSync to Notion if configured and active
    if (notionConfig.notionToken && notionConfig.notionDatabaseId && notionConfig.autoSync) {
      syncSingleToNotion(transactionData);
    }

    // Reset Form fields
    setTxAmount("");
    setTxDescription("");
    setTxMerchant("");
    setTxLabels("");
    setTxCategory("Other");
    setHasUserManuallySetCategory(false);
    
    // Redirect to dashboard home
    setActiveTab("dashboard");
  };

  // Sync to Notion API Connector
  const syncSingleToNotion = async (tx: Transaction) => {
    if (!notionConfig.notionToken || !notionConfig.notionDatabaseId) {
      alert("Please configure your Notion workspace credentials from the Notion tab first.");
      setActiveTab("notion");
      return;
    }

    setSyncPending(tx.id);

    try {
      const data = await syncToNotion(
        notionConfig.notionToken,
        notionConfig.notionDatabaseId,
        tx
      );
      markSynced(tx.id, data.id, data.url);
      setSyncSuccess(tx.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      console.error(err);
      setSyncError(tx.id, msg);
    }
  };

  const handleBulkSync = async () => {
    const unsynced = transactions.filter(t => !t.synced);
    if (unsynced.length === 0) {
      alert("All transactions are already synchronized to Notion!");
      return;
    }

    for (const tx of unsynced) {
      await syncSingleToNotion(tx);
    }
  };

  const exportToExcel = () => {
    if (transactions.length === 0) {
      alert("No logged transactions available to export yet. Try parsing an SMS first!");
      return;
    }

    // Define Excel compatible CSV headers
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
      "Created At"
    ];
    
    // Format rows safely enclosing commas and quotes
    const rows = transactions.map(tx => [
      tx.id,
      tx.date,
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${tx.merchant.replace(/"/g, '""')}"`,
      tx.amount,
      tx.type,
      tx.category,
      `"${tx.labels.join(', ').replace(/"/g, '""')}"`,
      tx.synced ? "Yes" : "No",
      tx.createdAt
    ]);

    // Combine headers and rows with newlines
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    // Add Unicode standard UTF-8 Byte-Order-Mark (BOM) for native Excel compatibility
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FinSnap_Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxAmount(String(tx.amount));
    setTxDescription(tx.description);
    setTxMerchant(tx.merchant);
    setTxDate(tx.date);
    setTxCategory(tx.category);
    setTxLabels(tx.labels.join(", "));
    setHasUserManuallySetCategory(true); // Don't trigger auto rules right away on editing
    setActiveTab("add");
  };

  const triggerDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this transaction from local storage?")) {
      deleteTransaction(id);
    }
  };

  // Filtered lists
  const filteredTransactions = transactions.filter(t => {
    const s = searchQuery.toLowerCase().trim();
    const matchesSearch = s === "" || 
      t.description.toLowerCase().includes(s) || 
      t.merchant.toLowerCase().includes(s) ||
      t.labels.some(l => l.toLowerCase().includes(s)) ||
      t.category.toLowerCase().includes(s);

    const matchesCategory = selectedCategoryFilter === "All" || t.category === selectedCategoryFilter;

    // Date range constraint checking
    let matchesDate = true;
    const { start, end } = getDateRangeLimits();
    if (start || end) {
      // mid-day timestamp comparison to prevent UTC/local date rollover complications
      const txTime = new Date(t.date + "T12:00:00").getTime();
      if (start && txTime < start.getTime()) {
        matchesDate = false;
      }
      if (end && txTime > end.getTime()) {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Calculations for Financial Summary Banner based dynamically on filter parameters
  const totalIncome = filteredTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Recharts Chart breakdown formatting: Category totals of filtered subset
  const chartData = Object.keys(CATEGORY_COLORS).map(catName => {
    const amt = filteredTransactions
      .filter(t => t.category === catName && t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      name: catName,
      value: parseFloat(amt.toFixed(2)),
      color: CATEGORY_COLORS[catName as CategoryType]
    };
  }).filter(item => item.value > 0);

  const totalExpenseForCharts = chartData.reduce((sum, item) => sum + item.value, 0);

  // Weekly spend trend analysis (Last 7 Days vs. Previous 7 Days)
  const getWeeklyTrendData = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const trendData = [];
    
    for (let i = 6; i >= 0; i--) {
      const targetDateCurrent = new Date(today);
      targetDateCurrent.setDate(today.getDate() - i);
      const strCurrent = targetDateCurrent.toISOString().split('T')[0];

      const targetDatePrevious = new Date(today);
      targetDatePrevious.setDate(today.getDate() - i - 7);
      const strPrevious = targetDatePrevious.toISOString().split('T')[0];

      const dayLabel = i === 0 ? "Today" : targetDateCurrent.toLocaleDateString("en-US", { weekday: "short" });

      const currentSum = transactions
        .filter(t => t.type === "expense" && t.date === strCurrent)
        .reduce((sum, t) => sum + t.amount, 0);

      const previousSum = transactions
        .filter(t => t.type === "expense" && t.date === strPrevious)
        .reduce((sum, t) => sum + t.amount, 0);

      trendData.push({
        dayName: dayLabel,
        currentDate: strCurrent,
        previousDate: strPrevious,
        "Last 7 Days (₹)": parseFloat(currentSum.toFixed(2)),
        "Previous 7 Days (₹)": parseFloat(previousSum.toFixed(2)),
      });
    }

    return trendData;
  };

  const weeklyTrendData = getWeeklyTrendData();

  return (
    <AndroidFrame 
      title={
        currentUser 
          ? "Notion Smart Tracker" 
          : onboardingStep === "signup" 
            ? "Create Account" 
            : onboardingStep === "signin" 
              ? "Login Account" 
              : "Secure SMS Tracker"
      }
      showBack={currentUser ? activeTab !== "dashboard" : onboardingStep !== "welcome"}
      onBack={() => {
        if (!currentUser) {
          setOnboardingStep("welcome");
          setAuthError("");
        } else {
          setEditingTxId(null);
          setActiveTab("dashboard");
        }
      }}
      theme={theme}
      actions={
        <div className="flex items-center gap-1.5 animate-fadeIn">
          <button
            id="top-action-theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="text-slate-350 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center select-none shrink-0"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon className="w-3.5 h-3.5 text-slate-300" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-350 fill-amber-350" />
            )}
          </button>

          {currentUser && (
            <>
              <button
                id="top-action-ai-config"
                onClick={() => setActiveTab(activeTab === "ai" ? "dashboard" : "ai")}
                className={`text-slate-200 text-[10px] font-bold px-2 py-1 border rounded-full hover:bg-white/5 transition-all flex items-center gap-1 cursor-pointer select-none ${
                  activeTab === "ai"
                    ? "bg-indigo-600/35 border-indigo-500 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                    : llmConfig.provider !== "gemini"
                      ? "bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25"
                      : "bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white"
                }`}
              >
                <Cpu className="w-3 h-3 text-indigo-400" />
                {llmConfig.provider === "gemini" 
                  ? (llmConfig.apiKey ? "My Gemini" : "Built-in Gemini") 
                  : llmConfig.provider === "openrouter" 
                    ? "OpenRouter" 
                    : "OpenAI"
                }
              </button>

              {notionConfig.databaseTitle ? (
                <button 
                  id="top-action-notion-indicator"
                  onClick={() => setActiveTab("notion")}
                  className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer hover:bg-emerald-500/25"
                >
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  Notion Live
                </button>
              ) : (
                <button 
                  id="top-action-notion"
                  onClick={() => setActiveTab("notion")}
                  className="text-amber-400 font-semibold text-[10px] px-2 py-1 border border-amber-400/30 rounded-full hover:bg-amber-400/10 cursor-pointer flex items-center gap-1"
                >
                  <Database className="w-3 h-3" /> Connect
                </button>
              )}

              <button
                id="top-action-logout"
                onClick={handleLogOut}
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-full hover:bg-red-500/10 transition-colors cursor-pointer flex items-center justify-center select-none shrink-0"
                title="Log Out User Session"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-300 hover:text-rose-400" />
              </button>
            </>
          )}
        </div>
      }
    >
      {/* Floating System Push Notification banner simulating real-time Android interception */}
      {activeIncomingToast && (
        <div className="absolute top-2 left-2 right-2 bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-3 rounded-2xl shadow-xl z-50 border border-slate-700/50 flex gap-3 pointer-events-auto transition-all transform animate-fadeIn translate-y-0">
          <div className="bg-indigo-600 text-white p-2 h-9 w-9 flex items-center justify-center rounded-xl font-bold shrink-0 shadow-md">
            <Bell className="w-4 h-4 text-white animate-bounce" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">{activeIncomingToast.sender}</span>
              <span className="text-[9px] text-slate-500 font-medium">just now</span>
            </div>
            <p className="text-[11px] font-bold text-white mt-0.5 tracking-tight line-clamp-1">{activeIncomingToast.body}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">SMS Auto-Interception Active</span>
            </div>
          </div>
          <button
            onClick={() => setActiveIncomingToast(null)}
            className="p-1 text-slate-400 hover:text-white shrink-0 self-start transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ONBOARDING FLOW (IF NO USER REGISTERED / LOGGED IN) */}
      {!currentUser && (
        <div className="flex-1 bg-slate-50 dark:bg-[#0b121f] text-slate-800 dark:text-slate-100 flex flex-col p-6 justify-center transition-colors">
          
          {onboardingStep === "welcome" && (
            <div className="space-y-6 my-auto animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white pt-2">
                  Notion Smart Tracker
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                  Automated Indian Bank UPI SMS parsing & secure sync to your personal Notion databases.
                </p>
              </div>

              {/* Benefits checklist */}
              <div className="space-y-3.5 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">Android SMS Interceptor</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Instantly parse incoming UPI SMS billing alerts from major Indian banks (HDFC, ICICI, SBI) locally.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">Notion Live Database</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Synchronize offline cash flow entries with customized properties in one click.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">Built-in Gemini AI</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Intelligent fallback heuristics and dynamic model tag matching out of the box.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-4">
                <button
                  onClick={() => setOnboardingStep("signup")}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer select-none transition-colors"
                >
                  <span>Build Free Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                
                <button
                  onClick={() => setOnboardingStep("signin")}
                  className="w-full bg-transparent border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold py-3 px-4 rounded-xl text-xs cursor-pointer select-none transition-colors"
                >
                  I already have an account
                </button>
              </div>
            </div>
          )}

          {onboardingStep === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4 my-auto animate-fadeIn">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Create New Account</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Sign up locally to unlock biometric auto-sync vaults</p>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-2 text-rose-700 dark:text-rose-300 text-[11px]">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] tracking-wide font-bold text-slate-500 dark:text-slate-400 uppercase">Your Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Akshaya"
                      required
                      value={signupForm.name}
                      onChange={e => setSignupForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] tracking-wide font-bold text-slate-500 dark:text-slate-400 uppercase">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="akshaya.lang.dev@gmail.com"
                      required
                      value={signupForm.email}
                      onChange={e => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] tracking-wide font-bold text-slate-500 dark:text-slate-400 uppercase">Choose Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      required
                      value={signupForm.password}
                      onChange={e => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 font-medium text-[10.5px] text-slate-500 dark:text-slate-400">
                  <input 
                    type="checkbox" 
                    id="agree-rules"
                    checked={signupForm.agreed} 
                    onChange={e => setSignupForm(prev => ({ ...prev, agreed: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="agree-rules" className="cursor-pointer select-none">
                    Agreed with local security sandbox policies & RBI guide.
                  </label>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-650 hover:bg-indigo-750 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl text-xs cursor-pointer select-none transition-colors"
                >
                  Verify Verification & Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => { setOnboardingStep("welcome"); setAuthError(""); }}
                  className="w-full bg-transparent text-slate-500 hover:text-slate-800 text-[11px] font-semibold text-center mt-1 transition-colors"
                >
                  Cancel & Go Back
                </button>
              </div>
            </form>
          )}

          {onboardingStep === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4 my-auto animate-fadeIn">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Verify Account Credentials</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">Welcome back! Sign in securely to access ledger settings</p>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-2 text-rose-700 dark:text-rose-300 text-[11px]">
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] tracking-wide font-bold text-slate-500 dark:text-slate-400 uppercase">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="akshaya.lang.dev@gmail.com"
                      required
                      value={signinForm.email}
                      onChange={e => setSigninForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] tracking-wide font-bold text-slate-500 dark:text-slate-400 uppercase">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      value={signinForm.password}
                      onChange={e => setSigninForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-650 text-white font-bold py-3 px-4 rounded-xl text-xs cursor-pointer select-none shadow-md shadow-indigo-600/10 transition-colors"
                >
                  Verify Verification & Log In
                </button>
                <button
                  type="button"
                  onClick={() => { setOnboardingStep("welcome"); setAuthError(""); }}
                  className="w-full bg-transparent text-slate-500 hover:text-slate-800 text-[11px] font-semibold text-center mt-1 transition-colors"
                >
                  Cancel & Go Back
                </button>
              </div>
            </form>
          )}

        </div>
      )}

      {currentUser && (
        <>
          {/* 1. HOME DASHBOARD SHEET */}
          {activeTab === "dashboard" && (
        <div className="flex-1 bg-slate-50 dark:bg-[#0b121f] text-slate-800 dark:text-slate-100 flex flex-col p-4 space-y-4 transition-colors">
          
          {/* Real-time Financial Wallet Summary Card */}
          <div id="wallet-summary-card" className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-5 rounded-3xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mt-10 -mr-10"></div>
            
            <div className="flex items-center justify-between mb-1 opacity-75">
              <span className="text-[11px] uppercase tracking-wider font-bold">Net Personal Balance (INR)</span>
              <Wallet className="w-4 h-4 text-slate-300" />
            </div>
            
            <h2 className="text-3xl font-extrabold tracking-tight font-mono">
              ₹{netBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-500/20 p-1.5 rounded-lg text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="opacity-75 text-[10px]">Total Income</p>
                  <p className="font-bold font-mono text-emerald-300">₹{totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-rose-500/20 p-1.5 rounded-lg text-rose-400">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <p className="opacity-75 text-[10px]">Spent</p>
                  <p className="font-bold font-mono text-rose-300">₹{totalExpense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fast Entry & SMS Simulation Integration Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 p-4 space-y-3 transition-colors">
            {/* Segmented control tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 pb-2 justify-between items-center">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFastEntryMode("sms")}
                  className={`text-xs font-bold pb-1 transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                    fastEntryMode === "sms"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> SMS Interceptor
                </button>
                <button
                  type="button"
                  onClick={() => setFastEntryMode("receipt")}
                  className={`text-xs font-bold pb-1 transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                    fastEntryMode === "receipt"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <FileImage className="w-3.5 h-3.5" /> Receipt Scanner
                </button>
              </div>
              <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-indigo-500 animate-pulse" /> Gemini AI
              </span>
            </div>

            {/* Mode 1: RECEIPT SCANNER (OCR) */}
            {fastEntryMode === "receipt" && (
              <form onSubmit={handleAiFastEntry} className="space-y-2">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Snap an order receipt or success screen from Swiggy/Blinkit/Zomato to extract and catalog spend transactions.
                </p>
                <textarea
                  value={fastEntryText}
                  onChange={(e) => setFastEntryText(e.target.value)}
                  placeholder="💡 Try typing: 'Spent ₹450 on Swiggy for Paneer Tikka' or upload a Swiggy / Blinkit grocery bill receipt screenshot..."
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 min-h-[60px]"
                />

                {receiptImageName && (
                  <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 px-3 py-1.5 rounded-xl text-xs text-indigo-800 dark:text-indigo-300">
                    <div className="flex items-center gap-1.5 font-semibold truncate max-w-[250px]">
                      <FileImage className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="truncate">{receiptImageName}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setReceiptImageName(null);
                        setReceiptBase64(null);
                      }}
                      className="p-0.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-605 dark:text-indigo-355 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer flex items-center justify-center gap-1"
                      title="Upload receipt screenshot"
                    >
                      <FileImage className="w-4 h-4" />
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1">Snap</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleReceiptChange}
                      accept="image/*"
                      className="hidden"
                    />
                    
                    {/* Preset quick test suggestions */}
                    <button
                      type="button"
                      onClick={() => triggerMockUpload("Paneer Biryani lunch for ₹350 at Swiggy")}
                      className="hidden md:block text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline cursor-pointer"
                    >
                      Load preset
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isAiParsing}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    {isAiParsing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Smart Scan
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Mode 2: Indian Banks UPI & SMS Automation Simulator */}
            {fastEntryMode === "sms" && (
              <div className="space-y-3">
                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200">
                    <Smartphone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Browser Security Warning</span>
                  </div>
                  <p className="text-[10.5px]">
                    To protect your privacy, web browsers (and this development iFrame) **cannot access your phone's physical hardware SMS inbox or system notification feed directly**.
                  </p>
                  <p className="text-[10.5px] font-medium text-slate-600 dark:text-slate-400">
                    <strong className="text-indigo-600 dark:text-indigo-400">⚡ Automated Sync Setup:</strong> For full continuous tracking on Android, you can download a free SMS webhook forwarding utility from Google Play Store (e.g. <em>&quot;SMS to Webhook&quot;</em>) to securely relay bank SMS alerts to your custom server endpoint!
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Simulated Bank / App UPI SMS Text
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const clipboardText = await navigator.clipboard.readText();
                          if (clipboardText && clipboardText.trim()) {
                            setSimulatedSmsText(clipboardText);
                            simulateSmsIntercept(clipboardText);
                          } else {
                            alert("Your clipboard is empty! Please copy a bank transaction SMS alert first.");
                          }
                        } catch (err) {
                          alert("Clipboard access blocked by browser security. Please paste your SMS content directly into the text box below.");
                        }
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      📋 Paste & Scan Clipboard
                    </button>
                  </div>
                  <textarea
                    value={simulatedSmsText}
                    onChange={(e) => setSimulatedSmsText(e.target.value)}
                    placeholder="Enter or copy paste bank SMS alerts (e.g. 'Debited Rs 420 from HDFC Bank to Swiggy...')"
                    className="w-full text-xs p-2.5 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 min-h-[55px]"
                  />

                  {/* Preset Quick selections Grid */}
                  <div className="space-y-1">
                    <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-450 dark:text-slate-500">
                      Mock Transaction SMS Templates (Click to Load)
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSimulatedSmsText("HDFC Bank UPI: Debited ₹350.00 from ACXX5629 to Swiggy@axisbank Ref 616238 on 09-06-2026. Not you? Report.")}
                        className="p-1 px-1.5 text-[10px] bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none text-slate-705 text-slate-700 dark:text-slate-300 hover:text-indigo-800 dark:hover:text-indigo-405 rounded-lg text-left truncate font-medium border border-slate-200 dark:border-slate-800 font-mono cursor-pointer"
                        title="Swiggy meal via HDFC Bank UPI"
                      >
                        🍔 Swiggy ₹350 (HDFC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedSmsText("Axis Bank Credit Card: Spent ₹1250.00 at BLINKIT INSTAMART on 09-06-2026 18:30. Available limit ₹89,500.00.")}
                        className="p-1 px-1.5 text-[10px] bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none text-slate-705 text-slate-700 dark:text-slate-300 hover:text-indigo-800 dark:hover:text-indigo-405 rounded-lg text-left truncate font-medium border border-slate-200 dark:border-slate-800 font-mono cursor-pointer"
                        title="Blinkit groceries via Axis Credit Card"
                      >
                        🥦 Blinkit ₹1250 (Axis)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedSmsText("SBI debit: Debited ₹220.00 spent at Ola Cabs Auto via Google Pay UPI on 09-06-2026.")}
                        className="p-1 px-1.5 text-[10px] bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none text-slate-705 text-slate-700 dark:text-slate-300 hover:text-indigo-800 dark:hover:text-indigo-405 rounded-lg text-left truncate font-medium border border-slate-200 dark:border-slate-800 font-mono cursor-pointer"
                        title="Ola ride via SBI UPI"
                      >
                        🛺 Ola ride ₹220 (SBI)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedSmsText("ICICI Bank SMS: Your A/C XX784 is debited for ₹899.00 towards JIOUTILITY recharge on 09-06-2026.")}
                        className="p-1 px-1.5 text-[10px] bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none text-slate-705 text-slate-700 dark:text-slate-300 hover:text-indigo-800 dark:hover:text-indigo-405 rounded-lg text-left truncate font-medium border border-slate-200 dark:border-slate-800 font-mono cursor-pointer"
                        title="Jio Fiber internet via ICICI Bank"
                      >
                        🌐 Jio Wifi ₹899 (ICICI)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => simulateSmsIntercept()}
                    disabled={isAiParsing}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-[11px] font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 shadow-xs hover:shadow-md cursor-pointer"
                  >
                    {isAiParsing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Intercepting...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        Trigger Interception
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <button 
              id="quick-add-btn"
              onClick={() => {
                setEditingTxId(null);
                setTxAmount("");
                setTxDescription("");
                setTxMerchant("");
                setTxLabels("");
                setTxCategory("Other");
                setHasUserManuallySetCategory(false);
                setActiveTab("add");
              }}
              className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col items-center gap-1.5 focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer text-slate-800 dark:text-slate-100 transition-colors"
            >
              <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-semibold text-[11px]">Add New</span>
            </button>

            <button 
              id="quick-rules-btn"
              onClick={() => setActiveTab("rules")}
              className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col items-center gap-1.5 shadow-sm cursor-pointer text-slate-800 dark:text-slate-100 transition-colors"
            >
              <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 p-2 rounded-xl">
                <Sliders className="w-4 h-4" />
              </div>
              <span className="font-semibold text-[11px]">Auto Rules</span>
            </button>

            <button 
              id="quick-charts-btn"
              onClick={() => setActiveTab("charts")}
              className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col items-center gap-1.5 shadow-sm cursor-pointer text-slate-800 dark:text-slate-100 transition-colors"
            >
              <div className="bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 p-2 rounded-xl">
                <PieIcon className="w-4 h-4" />
              </div>
              <span className="font-semibold text-[11px]">Metrics</span>
            </button>

            <button 
              id="quick-notion-btn"
              onClick={() => setActiveTab("notion")}
              className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col items-center gap-1.5 shadow-sm cursor-pointer text-slate-800 dark:text-slate-100 transition-colors"
            >
              <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl">
                <Database className="w-4 h-4" />
              </div>
              <span className="font-semibold text-[11px]">Notion</span>
            </button>
          </div>

          {/* Excel spreadsheet export fallback banner when Notion is not setup */}
          {(!notionConfig.notionToken || !notionConfig.notionDatabaseId) && (
            <div className="bg-emerald-950 text-white rounded-2xl p-4 shadow-sm border border-emerald-900/40 space-y-2.5 my-3">
              <div className="flex items-start gap-2.5">
                <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-bold text-emerald-200">Save & Export to Excel</h4>
                  <p className="text-[10px] text-emerald-100/80 leading-relaxed font-medium">
                    Notion is not configured. Your transaction logs are safely stored locally. You can export them into Excel at any time!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportToExcel}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-[11px] py-1.5 rounded-xl border border-emerald-400/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                Download Excel Spreadsheet (.csv)
              </button>
            </div>
          )}

          {/* Transaction Section Header & Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Transaction History</h3>
              <div className="flex items-center gap-3">
                {transactions.length > 0 && (
                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear your local ledger? All un-synced entries will be permanently deleted.")) {
                        clearTransactions();
                      }
                    }}
                    className="text-[11px] text-red-500 hover:text-red-650 dark:text-red-400 dark:hover:text-red-300 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
                <button 
                  id="bulk-sync-notion-btn"
                  onClick={handleBulkSync}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Sync All to Notion
                </button>
              </div>
            </div>

            {/* Live Search Form & Pill Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by store, label, category..."
                  className="w-full text-xs pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              {/* Date Preset Filter Bar */}
              <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded-xl space-y-1.5 shadow-xs border border-slate-200/50 dark:border-slate-800/60">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-bold px-1 select-none">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-550 shrink-0" />
                    <span>Time Period</span>
                  </span>
                  
                  {/* Dynamic descriptive subtitle showing resolved limits */}
                  <span className="text-[10px] text-indigo-805 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/45 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40 font-sans">
                    {(() => {
                      const { start, end } = getDateRangeLimits();
                      if (!start && !end) return "All Time";
                      const format = (d: Date | null) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "...";
                      return `${format(start)} - ${format(end)}`;
                    })()}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1 text-[10px] uppercase tracking-wider font-extrabold text-center">
                  <button
                    type="button"
                    onClick={() => setDateRangePreset("all")}
                    className={`py-1 rounded-lg transition-all cursor-pointer ${
                      dateRangePreset === "all"
                        ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                        : "bg-white dark:bg-slate-920 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-350"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRangePreset("week")}
                    className={`py-1 rounded-lg transition-all cursor-pointer ${
                      dateRangePreset === "week"
                        ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                        : "bg-white dark:bg-slate-905 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-350"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRangePreset("month")}
                    className={`py-1 rounded-lg transition-all cursor-pointer ${
                      dateRangePreset === "month"
                        ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                        : "bg-white dark:bg-slate-905 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-350"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRangePreset("last_month")}
                    className={`py-1 rounded-lg transition-all cursor-pointer ${
                      dateRangePreset === "last_month"
                        ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                        : "bg-white dark:bg-slate-905 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-350"
                    }`}
                  >
                    Last Mo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRangePreset("custom")}
                    className={`py-1 rounded-lg transition-all cursor-pointer ${
                      dateRangePreset === "custom"
                        ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                        : "bg-white dark:bg-slate-905 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-350"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Collapsible custom input calendars */}
                {dateRangePreset === "custom" && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/30 dark:border-slate-800 animate-fadeIn">
                    <div>
                      <span className="block text-[8px] uppercase tracking-wider font-bold text-slate-405 dark:text-slate-500 mb-0.5 px-0.5">Start Date</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full text-[10px] font-bold px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase tracking-wider font-bold text-slate-405 dark:text-slate-500 mb-0.5 px-0.5">End Date</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full text-[10px] font-bold px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Horizontal Scroll Pill Filter lists */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                <button
                  onClick={() => setSelectedCategoryFilter("All")}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition-all font-semibold border ${
                    selectedCategoryFilter === "All" 
                      ? "bg-slate-900 dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  All ({transactions.length})
                </button>
                {CATEGORIES.map(cat => {
                  const count = transactions.filter(t => t.category === cat).length;
                  if (count === 0 && selectedCategoryFilter !== cat) return null; // hide empty filter pills unless selected
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full whitespace-nowrap transition-all font-semibold flex items-center gap-1.5 border ${
                        selectedCategoryFilter === cat 
                          ? "bg-slate-900 dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 text-white shadow-xs" 
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }}></span>
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Transactions List View */}
          <div className="space-y-2.5 flex-1 max-h-[350px] overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                <p>No transactions matched your search query.</p>
                <button 
                  onClick={() => { setSearchQuery(""); setSelectedCategoryFilter("All"); }}
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline mt-1.5 block mx-auto cursor-pointer"
                >
                  Clear filter filters
                </button>
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const syncStatus = syncLogs[tx.id]?.status || (tx.synced ? "success" : "idle");
                return (
                  <div 
                    key={tx.id} 
                    id={`transaction-item-${tx.id}`}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 shadow-xs hover:shadow-sm hover:border-slate-205 dark:hover:border-slate-700 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 truncate max-w-[70%]">
                      {/* Category-colored Tag Bubble */}
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
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={tx.description}>
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

                        {/* Labels / Tags chips list */}
                        {tx.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tx.labels.map((l, index) => (
                              <span key={`${l}-${index}`} className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-md text-[9px] lowercase flex items-center gap-0.5">
                                <Tag className="w-2 h-2 text-slate-400 dark:text-slate-500" /> {l}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 space-y-1.5 pl-2">
                      <div className="font-mono font-extrabold text-[13px]">
                        <span className={tx.type === "expense" ? "text-slate-800 dark:text-slate-100" : "text-emerald-600 dark:text-emerald-400"}>
                          {tx.type === "expense" ? "-" : "+"}
                          ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Line Sync / Edit Toolbar */}
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          title="Edit transaction details"
                          onClick={() => triggerEdit(tx)}
                          id={`btn-edit-tx-${tx.id}`}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-md"
                        >
                          Edit
                        </button>
                        
                        <button
                          title="Delete record locally"
                          onClick={() => triggerDelete(tx.id)}
                          id={`btn-delete-tx-${tx.id}`}
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-md"
                        >
                          Delete
                        </button>

                        {/* Individual Sync Trigger Button */}
                        <button
                          onClick={() => syncSingleToNotion(tx)}
                          title={tx.synced ? "Synced to Notion Database" : "Sync directly to Notion now"}
                          id={`btn-sync-tx-${tx.id}`}
                          className={`flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-lg border cursor-pointer transition-all ${
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
              })
            )}
          </div>
        </div>
      )}

      {/* 2. ADD / EDIT TRANSACTION PANEL SHEET */}
      {activeTab === "add" && (
        <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col p-4 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {editingTxId ? "✏️ Edit Transaction" : "📝 Add Transaction Detail"}
            </h2>
            <button
              onClick={() => {
                setEditingTxId(null);
                setActiveTab("dashboard");
              }}
              className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-semibold text-[11px]"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveTransaction} className="space-y-4 bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/80 flex-1 flex flex-col justify-between transition-colors">
            <div className="space-y-3.5">
              
              {/* Type toggle: Expense vs Income */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl">
                <button
                  type="button"
                  id="form-type-expense"
                  onClick={() => setTxType("expense")}
                  className={`py-2 text-xs font-bold rounded-xl transition-all capitalize cursor-pointer ${
                    txType === "expense" 
                      ? "bg-white dark:bg-slate-800 text-slate-805 dark:text-slate-100 shadow-sm font-extrabold" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-705 dark:hover:text-slate-200"
                  }`}
                >
                  🔴 Expense
                </button>
                <button
                  type="button"
                  id="form-type-income"
                  onClick={() => setTxType("income")}
                  className={`py-2 text-xs font-bold rounded-xl transition-all capitalize cursor-pointer ${
                    txType === "income" 
                      ? "bg-emerald-600 dark:bg-emerald-650 text-white shadow-sm font-extrabold" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-705 dark:hover:text-slate-200"
                  }`}
                >
                  🟢 Income / Salary
                </button>
              </div>

              {/* Amount Entry Field */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-350 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full text-base font-extrabold font-mono pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-820 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-700"
                    required
                  />
                </div>
              </div>

              {/* Merchant / Business Entity name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-350 uppercase tracking-wider mb-1">
                  Merchant / Store
                </label>
                <input
                  type="text"
                  placeholder="e.g. Swiggy, Zomato, Blinkit, Jio, Office Rent"
                  value={txMerchant}
                  onChange={(e) => {
                    setTxMerchant(e.target.value);
                    // allow suggestion to fire
                  }}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-820 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
                  required
                />
              </div>

              {/* Description Details */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-350 uppercase tracking-wider mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paneer Tikka, Grocery milk, JioFiber bill, monthly salary"
                  value={txDescription}
                  onChange={(e) => {
                    setTxDescription(e.target.value);
                    // allow suggestion to fire
                  }}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-820 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650"
                />
              </div>

              {/* Automatic Categorization Suggestion Notification Card */}
              {localSuggestedCategory && (
                <div 
                  id="smart-suggestion-banner"
                  className="bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-300/45 dark:border-amber-900/30 p-3 rounded-2xl flex flex-col space-y-1.5 animate-fadeIn"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 text-amber-900 dark:text-amber-350 text-xs">
                      <span className="text-base shrink-0 mt-0.5">💡</span>
                      <div>
                        <p className="font-bold flex items-center gap-1.5 leading-tight">
                          Suggest Category: 
                          <span 
                            className="px-2 py-0.5 text-[10px] text-white font-bold rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[localSuggestedCategory] }}
                          >
                            {localSuggestedCategory}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Matched by rule: {suggestionTrigger}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLocalSuggestedCategory(null)}
                      className="px-2.5 py-1 text-[10px] bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg font-bold"
                    >
                      Bypass
                    </button>
                    <button
                      type="button"
                      onClick={applySuggestedCategory}
                      id="btn-apply-suggestion"
                      className="px-3 py-1 text-[10px] bg-amber-500 text-slate-900 border border-amber-300 font-bold hover:bg-amber-600 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      Apply Suggestion
                    </button>
                  </div>
                </div>
              )}

              {/* Category Dropdown & Custom Override Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-350 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Category Selection</span>
                  {hasUserManuallySetCategory && (
                    <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-805 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">
                      User Override Active
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <select
                    value={txCategory}
                    id="form-category-select"
                    onChange={(e) => {
                      setTxCategory(e.target.value as CategoryType);
                      setHasUserManuallySetCategory(true); // Don't wipe manual selections with hooks
                    }}
                    className="col-span-9 text-xs px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  
                  {/* Category visual representation bubble next to it */}
                  <div className="col-span-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center">
                    <span 
                      className="w-5 h-5 rounded-full transition-colors border" 
                      style={{ 
                        backgroundColor: CATEGORY_COLORS[txCategory],
                        borderColor: 'rgba(0,0,0,0.1)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Transaction Execution Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-350 uppercase tracking-wider mb-1">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                {/* Tags / Custom categorization tags */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-350 uppercase tracking-wider mb-1">
                    Labels / tags (split with ,)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. break, beverage, breakfast"
                    value={txLabels}
                    onChange={(e) => setTxLabels(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650"
                  />
                </div>
              </div>

            </div>

            <button
              type="submit"
              id="form-submit-btn"
              className="w-full bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-550 text-white font-extrabold rounded-2xl py-3 text-xs tracking-wide shadow-md mt-6 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {editingTxId ? "Confirm & Update Details" : "Record Local Transaction"}
            </button>
          </form>
        </div>
      )}

      {/* 3. MANAGE CUSTOM CATEGORIZATION RULES SHEET */}
      {activeTab === "rules" && (
        <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col p-4 space-y-4 transition-colors">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 dark:bg-amber-950/40 text-amber-850 dark:text-amber-400 p-2 rounded-xl">
              <Sliders className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Automation Rule Engine</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Auto-categorize matching keywords</p>
            </div>
          </div>

          {/* Quick Creator Form for Keyword matching */}
          <form onSubmit={handleCreateRule} className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transition-colors">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Add Automatic Keyword Rule</h3>
            
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-405 dark:text-slate-400 mb-1">
                  Trigger Keyword (case-insensitive)
                </label>
                <input
                  type="text"
                  placeholder="e.g. steam, shell, netflix, target, chevron"
                  value={newRuleKeyword}
                  onChange={(e) => setNewRuleKeyword(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-450 dark:text-slate-400 mb-1">
                  Assign Category Automatically
                </label>
                <select
                  value={newRuleCategory}
                  onChange={(e) => setNewRuleCategory(e.target.value as CategoryType)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              id="btn-create-rule"
              className="w-full bg-amber-500 dark:bg-amber-600 text-slate-950 dark:text-slate-100 font-extrabold text-xs py-2 rounded-xl transition-all shadow-sm cursor-pointer hover:bg-amber-600 dark:hover:bg-amber-500"
            >
              Add Auto-Categorization Rule
            </button>
          </form>

          {/* List of active keywords mapping */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Active Categorization Rules ({rules.length})</span>
              <button 
                type="button"
                onClick={() => {
                  if (confirm("Reset active rules to system default?")) {
                    resetRules();
                  }
                }}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
              >
                Reset Default
              </button>
            </h3>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {rules.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-xs text-slate-400 dark:text-slate-500">
                  No automated rule mappings created. Add one above!
                </div>
              ) : (
                rules.map(rule => (
                  <div 
                    key={rule.id} 
                    id={`rule-item-${rule.id}`}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/85 rounded-2xl p-3 flex items-center justify-between shadow-xs hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2 max-w-[70%]">
                      <span className="font-mono bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-lg text-xs truncate max-w-[150px]" title={rule.keyword}>
                        {rule.keyword}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-550 flex-shrink-0" />
                      <span 
                        className="px-2 py-0.5 text-[10px] text-white font-bold rounded-full whitespace-nowrap"
                        style={{ backgroundColor: CATEGORY_COLORS[rule.category] }}
                      >
                        {rule.category}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      id={`btn-delete-rule-${rule.id}`}
                      className="p-1 px-2 border border-slate-100 dark:border-slate-800 rounded-lg text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. STATISTICS BREAKDOWN METRICS TAB */}
      {activeTab === "charts" && (
        <div className="flex-1 bg-slate-50 dark:bg-slate-955 flex flex-col p-4 space-y-4 transition-colors">
          <div className="flex items-center gap-2">
            <div className="bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-400 p-2 rounded-xl">
              <PieIcon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Spend Analytics</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Heuristic visual expenditures breakdown</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/80 space-y-3 transition-colors">
            <h3 className="text-xs font-bold text-slate-805 dark:text-slate-100">Expense Segment Allocation</h3>
            
            {chartData.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No expense transactions recorded yet to model segments. Keep adding records!
              </div>
            ) : (
              <div className="space-y-4">
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`₹${value}`, "Amount"]}
                        contentStyle={{ borderRadius: "12px", fontSize: "11px", borderColor: "#f1f5f9" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Interactive Legend with values */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {chartData.map(item => {
                    const pct = totalExpenseForCharts > 0 
                      ? ((item.value / totalExpenseForCharts) * 100).toFixed(1)
                      : "0";
                    return (
                      <div key={item.name} className="flex items-center justify-between border border-slate-100/50 dark:border-slate-800/55 p-1.5 rounded-xl bg-slate-50/50 dark:bg-slate-950/40">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                          <span className="font-semibold text-[10px] text-slate-750 dark:text-slate-300 truncate">{item.name}</span>
                        </div>
                        <span className="font-mono font-extrabold text-[11px] text-slate-900 dark:text-slate-100 pr-1 shrink-0">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Weekly Spend Trend Line Chart */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Weekly Spend Trend</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  Last 7 days vs Previous 7 days comparison
                </p>
              </div>
              <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-950/80 rounded-full">
                ₹ INR
              </span>
            </div>

            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis 
                    dataKey="dayName" 
                    tick={{ fill: "#64748b", fontSize: 9, fontWeight: 600 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: "#64748b", fontSize: 8, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: "12px", 
                      fontSize: "10px", 
                      backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", 
                      color: theme === "dark" ? "#f8fafc" : "#0f172a",
                      borderColor: theme === "dark" ? "#1e293b" : "#f1f5f9",
                      boxShadow: "0 4px 12px -2px rgba(0,0,0,0.05)"
                    }}
                    itemStyle={{ padding: "1px 0" }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={32}
                    iconSize={8}
                    wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Last 7 Days (₹)" 
                    stroke="#6366f1" 
                    strokeWidth={2.5}
                    activeDot={{ r: 5 }}
                    dot={{ r: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Previous 7 Days (₹)" 
                    stroke="#94a3b8" 
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Bar Chart representing history volume */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">Category Totals (₹)</h4>
            {chartData.length === 0 ? (
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-4">No categories populated</p>
            ) : (
              <div className="space-y-2">
                {chartData.sort((a,b) => b.value - a.value).map(item => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <span>{item.name}</span>
                      <span className="font-mono text-slate-800 dark:text-slate-205">₹{item.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          backgroundColor: item.color,
                          width: `${(item.value / totalExpenseForCharts) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. NOTION SYNC CONFIGURATION SHEET */}
      {activeTab === "notion" && (
        <NotionSettings
          config={notionConfig}
          onSaveConfig={async (updated) => {
            setNotionConfig(updated);
            const unsynced = transactions.filter(t => !t.synced);
            if (unsynced.length > 0 && updated.notionToken && updated.notionDatabaseId) {
              setTimeout(async () => {
                alert(`Successfully connected to Notion! Starting automatic synchronization of ${unsynced.length} existing transactions to your new database...`);
                for (const tx of unsynced) {
                  try {
                    const data = await syncToNotion(updated.notionToken, updated.notionDatabaseId, tx);
                    markSynced(tx.id, data.id, data.url);
                    setSyncSuccess(tx.id);
                  } catch (err) {
                    console.error("Auto Sync Fail for tx", tx.id, err);
                  }
                }
              }, 600);
            }
          }}
          onClose={() => setActiveTab("dashboard")}
          onExportToExcel={exportToExcel}
        />
      )}

      {/* 6. AI PROVIDER CONFIGURATION SHEET */}
      {activeTab === "ai" && (
        <AiSettings 
          config={llmConfig}
          onSaveConfig={(updated) => setLlmConfig(updated)}
          onClose={() => setActiveTab("dashboard")}
        />
      )}
        </>
      )}
    </AndroidFrame>
  );
}
