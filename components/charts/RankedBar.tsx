"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS, BAR_RADIUS_H, Tip } from "./chrome";
import { EmptyState } from "@/components/ui";

/** Horizontal ranked bars — one series, labels carry identity. */
export function RankedBar({
  data,
  color = "var(--chart-1)",
  unit,
  empty = "Nothing to show.",
  max = 8,
}: {
  data: { label: string; value: number; sub?: string }[];
  color?: string;
  unit: string;
  empty?: string;
  max?: number;
}) {
  const rows = data.slice(0, max);
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;

  return (
    <div
      className="w-full px-2 pb-3"
      style={{ height: Math.max(140, rows.length * 34 + 40) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" {...AXIS} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            {...AXIS}
            width={132}
            tick={{ fill: "var(--chart-label)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Tip
                  label={String(payload[0].payload.label)}
                  rows={[{ name: unit, value: Number(payload[0].value), color }]}
                  footer={payload[0].payload.sub}
                />
              ) : null
            }
          />
          <Bar dataKey="value" radius={BAR_RADIUS_H} maxBarSize={22}>
            {rows.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
