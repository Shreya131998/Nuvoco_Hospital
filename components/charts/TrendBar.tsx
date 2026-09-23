"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS, BAR_RADIUS, GRID, Tip } from "./chrome";
import { EmptyState } from "@/components/ui";

/** Single-series daily counts. One series, so no legend — the title names it. */
export function TrendBar({
  data,
  color = "var(--chart-1)",
  unit = "entries",
}: {
  data: { day: string; n: number }[];
  color?: string;
  unit?: string;
}) {
  if (!data.length) return <EmptyState>No activity in this period.</EmptyState>;
  const total = data.reduce((s, d) => s + d.n, 0);
  if (total === 0)
    return <EmptyState>No {unit} recorded in this period.</EmptyState>;

  return (
    <div className="h-56 w-full px-2 pb-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="day"
            {...AXIS}
            tickFormatter={(d: string) => d.slice(8) + "/" + d.slice(5, 7)}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis {...AXIS} allowDecimals={false} width={38} />
          <Tooltip
            cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Tip
                  label={String(label)}
                  rows={[{ name: unit, value: Number(payload[0].value), color }]}
                />
              ) : null
            }
          />
          <Bar dataKey="n" fill={color} radius={BAR_RADIUS} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
