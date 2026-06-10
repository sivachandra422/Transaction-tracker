import React from "react";
import { motion } from "motion/react";
import { PieChart as PieIcon, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, LineChart, Line, Legend,
} from "recharts";
import { useTransactionStore } from "../../store/transactionStore";
import { useTransactionFilters, useWeeklyTrend } from "../../hooks/useTransactionFilters";
import { formatINR } from "../../lib/format";
import { Card, EmptyState, SectionTitle } from "../../components/ui";

export default function AnalyticsScreen() {
  const transactions = useTransactionStore((s) => s.transactions);

  const { chartData, totalExpense } = useTransactionFilters({
    transactions,
    searchQuery: "",
    categoryFilter: "All",
    dateRangePreset: "all",
    customStartDate: "",
    customEndDate: "",
  });
  const weeklyTrendData = useWeeklyTrend(transactions);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex-1 bg-[#0b121f] text-slate-100 flex flex-col p-4 space-y-4 pb-6"
    >
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-indigo-950/50 text-indigo-400">
          <PieIcon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Spend Analytics</h2>
          <p className="text-[10px] text-slate-500">Where your money actually goes</p>
        </div>
      </div>

      {/* Allocation donut */}
      <Card>
        <SectionTitle>Expense Allocation</SectionTitle>
        {chartData.length === 0 ? (
          <EmptyState
            icon={<PieIcon />}
            title="No expense data yet"
            subtitle="Add a few transactions and your category breakdown will appear here."
          />
        ) : (
          <>
            <div className="h-48 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`₹${formatINR(Number(value))}`, "Spent"]}
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 12,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-mono font-bold text-slate-200">
                    ₹{formatINR(item.value, 0)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Weekly trend */}
      <Card>
        <SectionTitle>Weekly Spend Trend</SectionTitle>
        <p className="text-[10px] text-slate-500 mb-2">Last 7 days vs previous 7 days</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyTrendData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <XAxis
                dataKey="dayName"
                tick={{ fontSize: 9, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 12,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Line
                type="monotone"
                dataKey="Last 7 Days (₹)"
                stroke="#818cf8"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: "#818cf8" }}
              />
              <Line
                type="monotone"
                dataKey="Previous 7 Days (₹)"
                stroke="#334155"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Category totals bars */}
      <Card>
        <SectionTitle>Category Totals (₹)</SectionTitle>
        {chartData.length === 0 ? (
          <EmptyState icon={<TrendingDown />} title="Nothing to rank yet" />
        ) : (
          <div className="space-y-2.5 mt-2">
            {[...chartData]
              .sort((a, b) => b.value - a.value)
              .map((item) => {
                const pct = totalExpense > 0 ? (item.value / totalExpense) * 100 : 0;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-bold text-slate-300">{item.name}</span>
                      <span className="font-mono text-slate-400">
                        ₹{formatINR(item.value, 0)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
