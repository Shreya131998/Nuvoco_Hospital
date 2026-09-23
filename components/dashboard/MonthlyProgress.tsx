import { MONTHS } from "@/lib/dates";

/**
 * Mirrors the JAN..DEC columns of the paper sheet: how much of the
 * 99-item list was verified in each month.
 */
export function MonthlyProgress({
  data,
  year,
}: {
  data: { month_no: number; checked: number; total: number }[];
  year: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((m) => {
        const total = Number(m.total) || 1;
        const checked = Number(m.checked);
        const pct = Math.round((checked / total) * 100);
        return (
          <div key={m.month_no} className="rounded-lg border border-border p-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold">{MONTHS[m.month_no - 1]}</span>
              <span className="text-xs text-muted tabular-nums">
                {checked}/{total}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
              role="img"
              aria-label={`${MONTHS[m.month_no - 1]} ${year}: ${checked} of ${total} medicines verified`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background:
                    pct === 0 ? "transparent" : pct >= 100 ? "var(--sev-ok)" : "var(--chart-1)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
