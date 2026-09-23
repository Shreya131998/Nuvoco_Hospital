"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS, BAR_RADIUS, GRID, Legend, Tip } from "./chrome";
import { EmptyState } from "@/components/ui";

const SERIES = [
  { key: "first_aid", label: "First aid", color: "var(--chart-1)" },
  { key: "ambulance", label: "Ambulance", color: "var(--chart-2)" },
  { key: "medicine",  label: "Medicine",  color: "var(--chart-3)" },
] as const;

export type ActivityRow = {
  day: string;
  first_aid: number;
  ambulance: number;
  medicine: number;
};

/** Submissions per day, split by module. Grouped (not stacked) so each
 *  module's own trend stays readable. */
export function ModuleActivity({ data }: { data: ActivityRow[] }) {
  if (!data.length) return <EmptyState>No activity yet.</EmptyState>;
  const totals = SERIES.map((s) => ({
    ...s,
    value: data.reduce((sum, d) => sum + d[s.key], 0),
  }));
  if (totals.every((t) => t.value === 0))
    return <EmptyState>Nothing submitted in this period.</EmptyState>;

  return (
    <>
      <div className="h-60 w-full px-2 pt-2">
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
                    rows={SERIES.map((s) => ({
                      name: s.label,
                      value: payload[0].payload[s.key],
                      color: s.color,
                    }))}
                  />
                ) : null
              }
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={BAR_RADIUS}
                maxBarSize={14}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={totals} />
    </>
  );
}
