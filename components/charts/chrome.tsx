"use client";

import type { ReactNode } from "react";

/** Recessive axis/grid styling shared by every chart. */
export const AXIS = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--chart-label)", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "var(--chart-axis)" },
} as const;

export const GRID = {
  stroke: "var(--chart-grid)",
  strokeDasharray: "0",
  vertical: false,
} as const;

type TipRow = { name: string; value: number | string; color?: string };

export function Tip({
  label,
  rows,
  footer,
}: {
  label: ReactNode;
  rows: TipRow[];
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      <ul className="grid gap-0.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            {r.color && (
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: r.color }}
              />
            )}
            <span className="text-muted">{r.name}</span>
            <span className="ml-auto font-semibold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1 text-muted">{footer}</p>}
    </div>
  );
}

/** Identity is never carried by colour alone — every multi-series chart ships this. */
export function Legend({
  items,
}: {
  items: { label: string; color: string; value?: number | string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-3 text-xs">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ background: i.color }}
          />
          <span className="text-muted">{i.label}</span>
          {i.value !== undefined && (
            <span className="font-semibold tabular-nums">{i.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_H: [number, number, number, number] = [0, 4, 4, 0];
