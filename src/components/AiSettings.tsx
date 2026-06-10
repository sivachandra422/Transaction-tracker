import React, { useState } from "react";
import { Key, Cpu, Eye, EyeOff, Check, Sparkles, Save, ArrowLeft } from "lucide-react";
import type { LlmConfig } from "../types";

interface AiSettingsProps {
  config: LlmConfig;
  onSaveConfig: (updated: LlmConfig) => void;
  onClose: () => void;
}

export default function AiSettings({ config, onSaveConfig, onClose }: AiSettingsProps) {
  const [provider, setProvider] = useState<LlmConfig["provider"]>(config.provider || "gemini");
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [model, setModel] = useState(config.model || "gemini-2.5-flash");
  const [customModelInput, setCustomModelInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Suggested models per provider
  const PROVIDER_MODELS: Record<LlmConfig["provider"], Array<{ value: string; label: string; desc: string }>> = {
    gemini: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Built-in / Fast)", desc: "Optimized speed & great extraction correctness." },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Powerful)", desc: "Higher reasoning, perfect for challenging custom queries." }
    ],
    openrouter: [
      { value: "google/gemini-2.5-flash:free", label: "Gemini 2.5 Flash (Free)", desc: "Completely free, fast, smart parser." },
      { value: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B (Free)", desc: "Completely free, high-performance reasoning." },
      { value: "deepseek/deepseek-chat", label: "DeepSeek V3 (Dirt Cheap)", desc: "Stellar parsing intelligence for fraction of a cent." },
      { value: "custom", label: "Custom OpenRouter Model", desc: "Type in any valid OpenRouter model identifier manually." }
    ],
    openai: [
      { value: "gpt-4o-mini", label: "GPT-4o Mini (Default)", desc: "High-speed, highly accurate tool-calling extraction." },
      { value: "gpt-4o", label: "GPT-4o (Premium)", desc: "Industry-standard robust intelligence." },
      { value: "custom", label: "Custom OpenAI Model", desc: "Manually enter custom OpenAI models (like gpt-3.5-turbo)." }
    ]
  };

  const handleProviderChange = (newProvider: LlmConfig["provider"]) => {
    setProvider(newProvider);
    // Auto-select standard default models
    if (newProvider === "gemini") {
      setModel("gemini-2.5-flash");
    } else if (newProvider === "openrouter") {
      setModel("google/gemini-2.5-flash:free");
    } else {
      setModel("gpt-4o-mini");
    }
    setIsSaved(false);
  };

  const currentAvailableModels = PROVIDER_MODELS[provider] || [];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalModel = model === "custom" ? customModelInput.trim() : model;

    if (provider !== "gemini" && !apiKey.trim()) {
      alert(`An API Key is required when using ${provider === "openrouter" ? "OpenRouter" : "OpenAI"}.`);
      return;
    }

    onSaveConfig({
      provider,
      apiKey: apiKey.trim(),
      model: finalModel
    });

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-[#0b121f] flex flex-col p-4 overflow-y-auto max-h-[600px] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 p-2 rounded-xl">
            <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">AI Parser Provider</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Power your receipt & transaction extractor</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1 bg-slate-150 dark:bg-slate-900 hover:bg-slate-205 dark:hover:bg-slate-800 rounded-lg border border-transparent dark:border-slate-800 transition-colors font-semibold flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </div>

      {/* Intro info box */}
      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl mb-4 text-[11px] leading-relaxed text-indigo-900 dark:text-indigo-300">
        <div className="flex gap-2 items-start">
          <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Zero-Cost Fallbacks available:</span> Connect to <strong className="font-extrabold text-indigo-950 dark:text-indigo-200">OpenRouter</strong> to use completely free LLMs (like Gemini Flash, Llama etc.) or set your OpenAI keys. Your keys are stored in secure session storage and never sent to our servers.
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* SELECT PROVIDER CARD */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 space-y-3 transition-colors">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Select AI Provider</label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
            {(["gemini", "openrouter", "openai"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => handleProviderChange(p)}
                className={`py-2 text-[10px] font-extrabold rounded-lg capitalize transition-all cursor-pointer ${
                  provider === p 
                    ? "bg-indigo-600 text-white shadow-xs" 
                    : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {p === "gemini" ? "Google Gemini" : p === "openrouter" ? "OpenRouter" : "OpenAI"}
              </button>
            ))}
          </div>
        </div>

        {/* DETAILS CONFIGURATION CARD */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800/80 space-y-4 transition-colors">
          {/* API Key Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Key className="w-3 h-3 text-slate-400" /> 
                {provider === "gemini" ? "API Key (Optional / Overwrites Built-in)" : `${provider === "openrouter" ? "OpenRouter" : "OpenAI"} API Key`}
              </label>
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5 inline mr-0.5" /> : <Eye className="w-3.5 h-3.5 inline mr-0.5" />}
                  {showKey ? "Hide" : "Reveal"}
                </button>
              )}
            </div>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setIsSaved(false);
              }}
              placeholder={provider === "gemini" ? "sk-xxxx (or leave blank for custom system default)" : "Pasted API key starts with sk-..."}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 font-mono transition-all"
              required={provider !== "gemini"}
            />
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-slate-400" /> Preferred Model
            </label>
            <div className="space-y-2">
              {currentAvailableModels.map((m) => {
                const isSelected = model === m.value || (m.value === "custom" && !currentAvailableModels.some(ext => ext.value === model));
                return (
                  <label
                    key={m.value}
                    onClick={() => {
                      setModel(m.value);
                      setIsSaved(false);
                    }}
                    className={`block p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200 shadow-xs"
                        : "border-slate-150 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[11px] font-bold tracking-tight">{m.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium leading-normal">{m.desc}</p>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Custom Input (if "custom" is selected or no presets match) */}
          {(model === "custom" || !currentAvailableModels.some(m => m.value === model)) && (
            <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 border-dashed animate-fadeIn">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                Custom Model Name Identifier
              </label>
              <input
                type="text"
                placeholder={provider === "openrouter" ? "e.g. meta-llama/llama-3-8b-instruct:free" : "e.g. gpt-4o-2024-05-13"}
                value={customModelInput || (!currentAvailableModels.some(m => m.value === model) ? model : "")}
                onChange={(e) => {
                  setCustomModelInput(e.target.value);
                  setModel("custom");
                  setIsSaved(false);
                }}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 font-mono transition-all text-slate-800 dark:text-slate-100"
              />
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          className={`w-full text-xs py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            isSaved 
              ? "bg-emerald-500 text-white hover:bg-emerald-600" 
              : "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800"
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 animate-bounce" />
              Settings Saved Perfectly!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save AI Provider Settings
            </>
          )}
        </button>
      </form>

      {/* QUICK TROUBLESHOOTING CARD */}
      <div className="mt-4 bg-slate-900 dark:bg-slate-955 text-white rounded-2xl p-4 shadow-sm border border-slate-800">
        <h4 className="text-[11px] font-bold text-slate-350 tracking-wider uppercase mb-1.5">How it works offline</h4>
        <p className="text-[10.5px] text-slate-300 leading-relaxed font-normal">
          We securely forward parsing requests from this interface straight to the AI server proxy on port 3000. All processing happens in real-time, and if any external provider experiences temporary service degradation, the ledger auto-activates on-device regex fallback parsing instantly to preserve your entry.
        </p>
      </div>
    </div>
  );
}
