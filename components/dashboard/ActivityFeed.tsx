import { Briefcase, Truck, Pill } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import type { Activity, Module } from "@/lib/types";

const ICON: Record<Module, typeof Briefcase> = {
  first_aid: Briefcase,
  ambulance: Truck,
  medicine: Pill,
};
const TONE: Record<Module, string> = {
  first_aid: "bg-info-soft text-info",
  ambulance: "bg-warn-soft text-warn",
  medicine: "bg-primary-soft text-primary",
};

export function ActivityFeed({ rows, limit = 12 }: { rows: Activity[]; limit?: number }) {
  if (!rows.length) return <EmptyState>No submissions in this period.</EmptyState>;
  return (
    <ul className="divide-y divide-border">
      {rows.slice(0, limit).map((r) => {
        const Icon = ICON[r.module];
        return (
          <li key={`${r.module}-${r.record_id}`} className="flex items-start gap-3 px-4 py-3">
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${TONE[r.module]}`}>
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.person}</p>
              <p className="truncate text-xs text-muted">{r.ref_label}</p>
              {r.remarks && (
                <p className="mt-1 line-clamp-2 text-xs italic text-muted">“{r.remarks}”</p>
              )}
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted">
              {fmtDateTime(r.at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
