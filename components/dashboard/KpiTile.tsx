import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/ui";

const TONE: Record<Tone, string> = {
  ok: "text-ok bg-ok-soft",
  warn: "text-warn bg-warn-soft",
  danger: "text-danger bg-danger-soft",
  info: "text-info bg-info-soft",
  primary: "text-primary bg-primary-soft",
  muted: "text-muted bg-surface-2",
};

export function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE[tone])}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
