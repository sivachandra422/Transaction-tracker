import React from "react";
import { motion } from "motion/react";
import { Check, Sparkles, TrendingDown, TrendingUp, Calendar, Tag, Building2 } from "lucide-react";
import type { CategoryType, Transaction } from "../../types";
import { CATEGORIES, CATEGORY_COLORS } from "../../constants";
import { useTransactionStore } from "../../store/transactionStore";
import { useTxFormStore } from "../../store/txFormStore";
import { useCategorySuggestion } from "../../hooks/useCategorySuggestion";
import { useNotionSync } from "../../hooks/useNotionSync";
import { nowISO } from "../../lib/format";
import { Button, Card, Field, SegmentedControl, inputClass } from "../../components/ui";

interface TransactionFormScreenProps {
  onDone: () => void;
  onNeedNotionConfig: () => void;
}

export default function TransactionFormScreen({
  onDone,
  onNeedNotionConfig,
}: TransactionFormScreenProps) {
  const { transactions, rules, addTransaction, updateTransaction } = useTransactionStore();
  const form = useTxFormStore();
  const { syncSingle, configured, autoSync } = useNotionSync(onNeedNotionConfig);
  const [formError, setFormError] = React.useState("");

  const suggestion = useCategorySuggestion(
    form.description,
    form.merchant,
    rules,
    !form.manualCategory
  );

  const applySuggestion = () => {
    if (suggestion.category) {
      form.patch({ category: suggestion.category, manualCategory: true });
      suggestion.clear();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(form.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setFormError("Please enter a valid amount greater than zero.");
      return;
    }
    setFormError("");

    const labels = Array.from(
      new Set(
        form.labels
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      )
    );

    const existing = form.editingTxId
      ? transactions.find((t) => t.id === form.editingTxId)
      : undefined;

    const tx: Transaction = {
      id: form.editingTxId || `tx-${Date.now()}`,
      amount: amountVal,
      description: form.description.trim() || `${form.category} item`,
      merchant: form.merchant.trim() || "Unspecified",
      category: form.category,
      type: form.type,
      date: form.date,
      labels,
      synced: existing?.synced ?? false,
      notionPageId: existing?.notionPageId,
      notionUrl: existing?.notionUrl,
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    };

    if (form.editingTxId) {
      updateTransaction(tx);
    } else {
      addTransaction(tx);
    }

    if (configured && autoSync) {
      void syncSingle(tx);
    }

    form.reset();
    onDone();
  };

  const isEditing = Boolean(form.editingTxId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex-1 bg-[#0b121f] text-slate-100 flex flex-col p-4 space-y-4 pb-6"
    >
      <h2 className="text-base font-bold text-slate-100">
        {isEditing ? "Edit Transaction" : "New Transaction"}
      </h2>

      {form.aiNote && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{form.aiNote}</span>
        </div>
      )}

      {formError && (
        <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-xl text-[11px] text-rose-300">
          {formError}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <SegmentedControl
          value={form.type}
          onChange={(type) => form.patch({ type })}
          options={[
            {
              value: "expense",
              label: (
                <span className="inline-flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Expense
                </span>
              ),
            },
            {
              value: "income",
              label: (
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Income
                </span>
              ),
            },
          ]}
          tones={{
            expense: "bg-rose-600/80 text-white shadow-md shadow-rose-600/25",
            income: "bg-emerald-600/80 text-white shadow-md shadow-emerald-600/25",
          }}
        />

        <Field label="Amount (₹)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
            value={form.amount}
            onChange={(e) => form.patch({ amount: e.target.value })}
            className={`${inputClass()} text-xl font-mono font-bold py-3.5`}
          />
        </Field>

        <Field label="Merchant" icon={<Building2 />}>
          <input
            type="text"
            placeholder="e.g. Swiggy, Amazon"
            value={form.merchant}
            onChange={(e) => form.patch({ merchant: e.target.value })}
            className={inputClass(true)}
          />
        </Field>

        <Field label="Description">
          <input
            type="text"
            placeholder="What was this for?"
            value={form.description}
            onChange={(e) => form.patch({ description: e.target.value })}
            className={inputClass()}
          />
        </Field>

        {/* Smart suggestion banner */}
        {suggestion.category && suggestion.category !== form.category && (
          <Card className="!p-3 border-indigo-700/40 bg-indigo-950/30 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-indigo-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                Suggested: {suggestion.category}
              </p>
              <p className="text-[9.5px] text-indigo-400/80 truncate">{suggestion.trigger}</p>
            </div>
            <Button
              type="button"
              variant="primary"
              className="!py-1.5 !px-3 shrink-0"
              onClick={applySuggestion}
            >
              <Check className="w-3 h-3" /> Apply
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[form.category] }}
              />
              <select
                value={form.category}
                onChange={(e) =>
                  form.patch({
                    category: e.target.value as CategoryType,
                    manualCategory: true,
                  })
                }
                className={`${inputClass()} pl-8`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Date" icon={<Calendar />}>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => form.patch({ date: e.target.value })}
              className={inputClass(true)}
            />
          </Field>
        </div>

        <Field label="Tags (comma separated)" icon={<Tag />}>
          <input
            type="text"
            placeholder="travel, reimbursable"
            value={form.labels}
            onChange={(e) => form.patch({ labels: e.target.value })}
            className={inputClass(true)}
          />
        </Field>

        <Button full type="submit" className="!py-3.5">
          <Check className="w-4 h-4" />
          {isEditing ? "Save Changes" : "Add Transaction"}
        </Button>
      </form>
    </motion.div>
  );
}
