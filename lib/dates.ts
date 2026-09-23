/**
 * Every date in this system is a plant-local (IST) date.
 *
 * The database runs UTC. A night-shift entry at 02:00 IST is 20:30 UTC on the
 * PREVIOUS day, so using the server's own date would file night-shift checks
 * against the wrong day and make shift compliance look broken. All conversions
 * go through here.
 */
export const IST = "Asia/Kolkata";

/** Today in IST as YYYY-MM-DD. */
export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

/** Convert an instant to its IST calendar date (YYYY-MM-DD). */
export function istDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date(d));
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** First day of the IST month, e.g. 2026-09-01. */
export function istMonthStart(isoDate = istToday()): string {
  return isoDate.slice(0, 8) + "01";
}

export type RangeKey = "today" | "7d" | "30d";

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

/** Inclusive [from, to] window in IST dates. "7d" includes today. */
export function resolveRange(key: RangeKey): { from: string; to: string } {
  const to = istToday();
  if (key === "today") return { from: to, to };
  return { from: addDays(to, key === "7d" ? -6 : -29), to };
}

export function parseRange(v: string | undefined): RangeKey {
  return v === "today" || v === "7d" || v === "30d" ? v : "today";
}

const DISPLAY = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST, day: "2-digit", month: "short", year: "numeric",
});
const DISPLAY_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST, day: "2-digit", month: "short",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

export const fmtDate = (d?: string | null) => (d ? DISPLAY.format(new Date(d + "T00:00:00Z")) : "—");
export const fmtDateTime = (d?: string | null) => (d ? DISPLAY_TIME.format(new Date(d)) : "—");

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
