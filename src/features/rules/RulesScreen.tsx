import React, { useState } from "react";
import { motion } from "motion/react";
import { Sliders, Trash2, RotateCcw, Plus } from "lucide-react";
import type { CategoryType } from "../../types";
import { CATEGORIES, CATEGORY_COLORS } from "../../constants";
import { useTransactionStore } from "../../store/transactionStore";
import { Button, Card, Field, SectionTitle, EmptyState, inputClass } from "../../components/ui";

export default function RulesScreen() {
  const { rules, addRule, deleteRule, resetRules } = useTransactionStore();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<CategoryType>("Food");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    addRule({
      id: `rule-${Date.now()}`,
      keyword: keyword.trim().toLowerCase(),
      category,
    });
    setKeyword("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex-1 bg-[#0b121f] text-slate-100 flex flex-col p-4 space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-indigo-950/50 text-indigo-400">
          <Sliders className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Automation Rules</h2>
          <p className="text-[10px] text-slate-500">
            Keywords that auto-categorize new transactions
          </p>
        </div>
      </div>

      <Card className="space-y-3">
        <h3 className="text-xs font-bold text-slate-200">Add Keyword Rule</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Keyword or phrase">
            <input
              type="text"
              placeholder='e.g. "swiggy", "metro card"'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className={inputClass()}
            />
          </Field>
          <Field label="Assign category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryType)}
              className={inputClass()}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Button full type="submit" disabled={!keyword.trim()}>
            <Plus className="w-3.5 h-3.5" /> Create Rule
          </Button>
        </form>
      </Card>

      <SectionTitle
        action={
          <button
            onClick={resetRules}
            className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset defaults
          </button>
        }
      >
        Active Rules ({rules.length})
      </SectionTitle>

      <div className="space-y-2 pb-4">
        {rules.length === 0 ? (
          <EmptyState
            icon={<Sliders />}
            title="No rules yet"
            subtitle="Add a keyword above to start auto-categorizing transactions."
          />
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-slate-900/80 border border-slate-800/80 rounded-xl px-3.5 py-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[rule.category] }}
                />
                <span className="text-xs font-bold text-slate-200 truncate">
                  “{rule.keyword}”
                </span>
                <span className="text-[10px] text-slate-500">→ {rule.category}</span>
              </div>
              <button
                onClick={() => deleteRule(rule.id)}
                title="Delete rule"
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
