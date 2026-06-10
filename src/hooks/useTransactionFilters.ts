import { useMemo } from "react";
import type { Transaction, CategoryType } from "../types";
import { CATEGORY_COLORS } from "../constants";
import { getDateRangeLimits, isWithinRange, type DateRangePreset } from "../lib/dateRanges";

export interface TransactionFilterInput {
  transactions: Transaction[];
  searchQuery: string;
  categoryFilter: string;
  dateRangePreset: DateRangePreset;
  customStartDate: string;
  customEndDate: string;
}

export function useTransactionFilters({
  transactions,
  searchQuery,
  categoryFilter,
  dateRangePreset,
  customStartDate,
  customEndDate,
}: TransactionFilterInput) {
  const dateRangeLimits = useMemo(
    () => getDateRangeLimits(dateRangePreset, customStartDate, customEndDate),
    [dateRangePreset, customStartDate, customEndDate]
  );

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        const s = searchQuery.toLowerCase().trim();
        const matchesSearch =
          s === "" ||
          t.description.toLowerCase().includes(s) ||
          t.merchant.toLowerCase().includes(s) ||
          t.labels.some((l) => l.toLowerCase().includes(s)) ||
          t.category.toLowerCase().includes(s);

        const matchesCategory = categoryFilter === "All" || t.category === categoryFilter;
        return matchesSearch && matchesCategory && isWithinRange(t.date, dateRangeLimits);
      }),
    [transactions, searchQuery, categoryFilter, dateRangeLimits]
  );

  const totalIncome = useMemo(
    () => filtered.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [filtered]
  );
  const totalExpense = useMemo(
    () => filtered.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    [filtered]
  );
  const netBalance = totalIncome - totalExpense;

  const chartData = useMemo(
    () =>
      (Object.keys(CATEGORY_COLORS) as CategoryType[])
        .map((catName) => {
          const amt = filtered
            .filter((t) => t.category === catName && t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);
          return {
            name: catName,
            value: parseFloat(amt.toFixed(2)),
            color: CATEGORY_COLORS[catName],
          };
        })
        .filter((item) => item.value > 0),
    [filtered]
  );

  return { filtered, totalIncome, totalExpense, netBalance, chartData, dateRangeLimits };
}

/** 7-day spend trend vs previous 7 days (uses ALL transactions, not filtered). */
export function useWeeklyTrend(transactions: Transaction[]) {
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
      const cur = new Date(today);
      cur.setDate(today.getDate() - i);
      const prev = new Date(today);
      prev.setDate(today.getDate() - i - 7);
      const strCur = cur.toISOString().split("T")[0];
      const strPrev = prev.toISOString().split("T")[0];
      const sumFor = (d: string) =>
        parseFloat(
          transactions
            .filter((t) => t.type === "expense" && t.date === d)
            .reduce((s, t) => s + t.amount, 0)
            .toFixed(2)
        );
      trendData.push({
        dayName: i === 0 ? "Today" : cur.toLocaleDateString("en-US", { weekday: "short" }),
        currentDate: strCur,
        previousDate: strPrev,
        "Last 7 Days (₹)": sumFor(strCur),
        "Previous 7 Days (₹)": sumFor(strPrev),
      });
    }
    return trendData;
  }, [transactions]);
}
