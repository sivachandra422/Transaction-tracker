export type DateRangePreset = "all" | "week" | "month" | "last_month" | "custom";

export interface DateRangeLimits {
  start: Date | null;
  end: Date | null;
}

export function getDateRangeLimits(
  preset: DateRangePreset,
  customStartDate?: string,
  customEndDate?: string
): DateRangeLimits {
  const now = new Date();
  switch (preset) {
    case "week": {
      const s = new Date(now);
      const day = s.getDay();
      s.setDate(s.getDate() - day + (day === 0 ? -6 : 1));
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case "last_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case "custom":
      return {
        start: customStartDate ? new Date(customStartDate + "T00:00:00") : null,
        end: customEndDate ? new Date(customEndDate + "T23:59:59") : null,
      };
    case "all":
    default:
      return { start: null, end: null };
  }
}

/** True if a tx date string (YYYY-MM-DD) falls within limits. */
export function isWithinRange(date: string, limits: DateRangeLimits): boolean {
  const { start, end } = limits;
  if (!start && !end) return true;
  // mid-day comparison avoids UTC/local date rollover
  const t = new Date(date + "T12:00:00").getTime();
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}
