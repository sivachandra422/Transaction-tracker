/**
 * FinSnap design system — fintech-dark primitives.
 * Tokens: bg #0b121f, surface slate-900, accent indigo, income emerald, expense rose.
 */
import React from "react";

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/40",
  secondary:
    "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80",
  ghost: "bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent",
  danger:
    "bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30",
  success:
    "bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  full?: boolean;
}

export function Button({
  variant = "primary",
  full = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${BUTTON_VARIANTS[variant]} ${full ? "w-full" : ""} font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer select-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// ─── Field (label + input/select wrapper) ───────────────────────────────────

export function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] tracking-widest font-bold text-slate-500 uppercase">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 [&>svg]:w-4 [&>svg]:h-4">
            {icon}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

export const inputClass = (withIcon = false) =>
  `w-full ${withIcon ? "pl-10" : "pl-4"} pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition-shadow`;

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeTone = "indigo" | "emerald" | "amber" | "rose" | "slate" | "purple";

const BADGE_TONES: Record<BadgeTone, string> = {
  indigo: "bg-indigo-500/15 border-indigo-500/30 text-indigo-300",
  emerald: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  amber: "bg-amber-500/15 border-amber-500/30 text-amber-300",
  rose: "bg-rose-500/15 border-rose-500/30 text-rose-300",
  slate: "bg-slate-700/40 border-slate-600/40 text-slate-300",
  purple: "bg-purple-500/15 border-purple-500/30 text-purple-300",
};

export function Badge({
  tone = "slate",
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${BADGE_TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

// ─── SegmentedControl ────────────────────────────────────────────────────────

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tones,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  /** Active classes per option value (defaults to indigo). */
  tones?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex bg-slate-950/70 border border-slate-800 rounded-xl p-1 gap-1">
      {options.map((opt) => {
        const active = value === opt.value;
        const activeClass =
          tones?.[opt.value] ?? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30";
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              active ? activeClass : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="p-3 rounded-2xl bg-slate-800/60 text-slate-500 [&>svg]:w-6 [&>svg]:h-6">
        {icon}
      </div>
      <p className="text-xs font-bold text-slate-300">{title}</p>
      {subtitle && <p className="text-[10px] text-slate-500 max-w-[240px]">{subtitle}</p>}
    </div>
  );
}

// ─── SectionTitle ────────────────────────────────────────────────────────────

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-slate-100 tracking-tight">{children}</h3>
      {action}
    </div>
  );
}
