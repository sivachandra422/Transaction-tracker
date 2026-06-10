/** Currency / number formatting helpers (single source of truth). */

export function formatINR(amount: number, fractionDigits = 2): string {
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function nowISO(): string {
  return new Date().toISOString();
}
