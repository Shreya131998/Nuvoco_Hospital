import "server-only";
import { backend } from "@/lib/data";
import { resolveRange, type RangeKey } from "@/lib/dates";
import type { Activity, Module } from "@/lib/types";

/** Dashboard reads. Backend-agnostic — see lib/data/contract.ts. */

export const getActivity = (r: RangeKey, m?: Module) =>
  backend().getActivity(resolveRange(r), m);

export const getDailyCounts = (m: Module, r: RangeKey) =>
  backend().getDailyCounts(m, resolveRange(r));

export const getBoxStatus = () => backend().getBoxStatus();
export const getMedicineStatus = () => backend().getMedicineStatus();

export const getShiftCompliance = (r: RangeKey) =>
  backend().getShiftCompliance(resolveRange(r));

export const getFailingPoints = (r: RangeKey) =>
  backend().getFailingPoints(resolveRange(r));

export const getTopRefilledItems = (r: RangeKey) =>
  backend().getTopRefilledItems(resolveRange(r));

export const getMedicineMonthly = (year: number) =>
  backend().getMedicineMonthly(year);

/** Turns a flat activity list into the per-day, per-module series the chart needs. */
export function toActivitySeries(rows: Activity[], from: string, to: string) {
  const byDay = new Map<string, { first_aid: number; ambulance: number; medicine: number }>();
  const cursor = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cursor <= end) {
    byDay.set(cursor.toISOString().slice(0, 10), { first_aid: 0, ambulance: 0, medicine: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  rows.forEach((r) => {
    const slot = byDay.get(r.on_date);
    if (slot) slot[r.module] += 1;
  });
  return [...byDay.entries()].map(([day, v]) => ({ day, ...v }));
}

/** Distinct people who submitted, most recent first — "who updated". */
export function summarisePeople(rows: Activity[]) {
  const m = new Map<string, { name: string; count: number; last: string }>();
  rows.forEach((r) => {
    const key = r.person.trim().toUpperCase();
    const cur = m.get(key);
    if (cur) {
      cur.count += 1;
      if (r.at > cur.last) cur.last = r.at;
    } else {
      m.set(key, { name: r.person.trim(), count: 1, last: r.at });
    }
  });
  return [...m.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}
