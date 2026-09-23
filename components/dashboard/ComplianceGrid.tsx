import { EmptyState } from "@/components/ui";
import { SHIFTS, type ShiftCompliance } from "@/lib/types";

/**
 * Date × shift grid. Missing shifts are rendered as cells, not omitted —
 * seeing what was skipped is the entire point of this view.
 */
export function ComplianceGrid({ rows }: { rows: ShiftCompliance[] }) {
  if (!rows.length) return <EmptyState>No vehicles configured.</EmptyState>;

  const vehicles = [...new Map(rows.map((r) => [r.vehicle_id, r])).values()];
  const dates = [...new Set(rows.map((r) => r.check_date))].sort().reverse();

  return (
    <div className="space-y-5 p-4">
      {vehicles.map((v) => {
        const mine = rows.filter((r) => r.vehicle_id === v.vehicle_id);
        const done = mine.filter((r) => r.done).length;
        const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;

        return (
          <div key={v.vehicle_id}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {v.vehicle_label}{" "}
                <span className="font-normal text-muted">{v.vehicle_no}</span>
              </h3>
              <span className="text-xs text-muted">
                <span className="font-semibold tabular-nums text-text">{pct}%</span>{" "}
                · {done} of {mine.length} shifts recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-surface pr-3 text-left font-medium text-muted">
                      Date
                    </th>
                    {SHIFTS.map((s) => (
                      <th key={s} className="w-16 pb-1 text-center font-medium text-muted">
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.map((d) => (
                    <tr key={d}>
                      <td className="sticky left-0 whitespace-nowrap bg-surface py-0.5 pr-3 text-muted tabular-nums">
                        {d.slice(8)}/{d.slice(5, 7)}
                      </td>
                      {SHIFTS.map((s) => {
                        const cell = mine.find(
                          (r) => r.check_date === d && r.shift === s
                        );
                        const failed = Number(cell?.failed_count ?? 0);
                        const title = cell?.done
                          ? `${d} shift ${s} — ${cell.driver_name}${
                              failed ? ` · ${failed} issue(s)` : " · all OK"
                            }`
                          : `${d} shift ${s} — not submitted`;
                        return (
                          <td key={s} className="p-0.5">
                            <div
                              title={title}
                              className={`grid h-6 place-items-center rounded text-[0.65rem] font-bold ${
                                !cell?.done
                                  ? "bg-danger-soft text-danger"
                                  : failed > 0
                                    ? "bg-warn-soft text-warn"
                                    : "bg-ok-soft text-ok"
                              }`}
                            >
                              {!cell?.done ? "—" : failed > 0 ? failed : "✓"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-ok-soft ring-1 ring-ok/30" />
          <span className="text-muted">Submitted, all OK</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-warn-soft ring-1 ring-warn/30" />
          <span className="text-muted">Submitted, issues found (number shown)</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-danger-soft ring-1 ring-danger/30" />
          <span className="text-muted">Not submitted</span>
        </li>
      </ul>
    </div>
  );
}
