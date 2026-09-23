"use client";

import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS, Legend, Tip } from "./chrome";
import { EmptyState } from "@/components/ui";

/**
 * Stock health by medicine category.
 *
 * Three buckets, not four. "Expiring within 90 days" was dropped from the
 * chart because amber and orange fail the normal-vision separation floor as
 * adjacent stack segments — readers genuinely cannot tell them apart. The
 * 90-day detail lives in the table below, where it is labelled in words.
 */
export const SEV = [
  { key: "valid",    label: "Valid",          color: "var(--sev-ok)" },
  { key: "expiring", label: "Expiring ≤30d",  color: "var(--sev-warn)" },
  { key: "expired",  label: "Expired / nil",  color: "var(--sev-bad)" },
] as const;

export type SevRow = {
  category: string;
  valid: number;
  expiring: number;
  expired: number;
  unknown: number;
};

export function SeverityStack({ data }: { data: SevRow[] }) {
  if (!data.length) return <EmptyState>No medicines configured.</EmptyState>;

  const totals = SEV.map((s) => ({
    ...s,
    value: data.reduce((sum, d) => sum + (d[s.key] as number), 0),
  }));

  return (
    <>
      <div
        className="w-full px-2 pt-2"
        style={{ height: Math.max(180, data.length * 30 + 36) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis type="number" {...AXIS} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="category"
              {...AXIS}
              width={140}
              tick={{ fill: "var(--chart-label)", fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <Tip
                    label={String(payload[0].payload.category)}
                    rows={SEV.map((s) => ({
                      name: s.label,
                      value: payload[0].payload[s.key],
                      color: s.color,
                    })).filter((r) => r.value > 0)}
                    footer={
                      payload[0].payload.unknown > 0
                        ? `${payload[0].payload.unknown} not yet checked`
                        : undefined
                    }
                  />
                ) : null
              }
            />
            {SEV.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="a"
                fill={s.color}
                maxBarSize={20}
                /* 2px surface ring gives the spacer between stacked fills */
                stroke="var(--surface)"
                strokeWidth={2}
                radius={i === SEV.length - 1 ? [0, 4, 4, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={totals} />
    </>
  );
}
