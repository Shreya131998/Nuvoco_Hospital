import { Fragment, type ReactNode } from "react";
import { EmptyState } from "@/components/ui";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide this column on phones, where space is scarce. */
  hideOnMobile?: boolean;
};

/**
 * Two presentations of the same rows.
 *
 * On a phone a five-column table squeezes every cell into a few characters
 * and pushes the last columns off-screen, so below `sm` each row is stacked
 * as a labelled card instead. From `sm` up it is a normal table that scrolls
 * horizontally inside its own card rather than widening the page.
 */
export function DataTable<T>({
  columns,
  rows,
  empty = "Nothing recorded in this period.",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey: (row: T, i: number) => string;
}) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;

  const [lead, ...rest] = columns;

  return (
    <>
      {/* Phone: one card per row */}
      <ul className="divide-y divide-border sm:hidden">
        {rows.map((r, i) => (
          <li key={rowKey(r, i)} className="px-4 py-3">
            <div className="text-sm font-medium">{lead.cell(r)}</div>
            <dl className="mt-1.5 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              {rest
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <Fragment key={c.key}>
                    <dt className="whitespace-nowrap text-muted">{c.header}</dt>
                    <dd className="min-w-0 break-words">{c.cell(r)}</dd>
                  </Fragment>
                ))}
            </dl>
          </li>
        ))}
      </ul>

      {/* Tablet and up: a real table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-4 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted ${c.className ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={rowKey(r, i)} className="hover:bg-surface-2/60">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-top ${c.className ?? ""}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
