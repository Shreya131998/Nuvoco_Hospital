import Link from "next/link";
import { Briefcase, Truck, Pill, TriangleAlert, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RangeToggle } from "@/components/dashboard/RangeToggle";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ModuleActivity } from "@/components/charts/ModuleActivity";
import { Card, Badge } from "@/components/ui";
import {
  getActivity, getBoxStatus, getMedicineStatus, getShiftCompliance,
  toActivitySeries, summarisePeople,
} from "@/lib/queries";
import { parseRange, resolveRange, RANGE_LABEL, istToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const { from, to } = resolveRange(range);

  const [activity, boxes, medicines, shifts] = await Promise.all([
    getActivity(range),
    getBoxStatus(),
    getMedicineStatus(),
    getShiftCompliance(range),
  ]);

  const today = istToday();
  const todayShifts = shifts.filter((s) => s.check_date === today);
  const shiftsDone = todayShifts.filter((s) => s.done).length;

  const expired = medicines.filter(
    (m) => m.expiry_status === "expired" || m.expiry_status === "out_of_stock"
  ).length;
  const expiring = medicines.filter((m) => m.expiry_status === "expiring_30").length;

  const boxesInWindow = new Set(
    activity.filter((a) => a.module === "first_aid").map((a) => a.ref_label)
  ).size;
  const neverChecked = boxes.filter((b) => b.days_since === null).length;
  const staleChecked = boxes.filter((b) => b.days_since !== null && b.days_since >= 90).length;
  const staleBoxes = neverChecked + staleChecked;

  const people = summarisePeople(activity);
  const series = toActivitySeries(activity, from, to);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="Overview"
        subtitle={`${RANGE_LABEL[range]} · ${activity.length} submission(s) by ${people.length} person(s)`}
        action={<RangeToggle value={range} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Boxes checked"
          value={boxesInWindow}
          sub={`of ${boxes.length} · ${RANGE_LABEL[range].toLowerCase()}`}
          icon={Briefcase}
          tone="info"
        />
        <KpiTile
          label="Shifts done today"
          value={`${shiftsDone}/${todayShifts.length || 3}`}
          sub={shiftsDone < (todayShifts.length || 3) ? "Some shifts missing" : "All shifts covered"}
          icon={Truck}
          tone={shiftsDone >= (todayShifts.length || 3) ? "ok" : "warn"}
        />
        <KpiTile
          label="Expiring ≤30 days"
          value={expiring}
          sub="medicines"
          icon={Pill}
          tone={expiring > 0 ? "warn" : "ok"}
        />
        <KpiTile
          label="Expired / nil stock"
          value={expired}
          sub="needs action"
          icon={TriangleAlert}
          tone={expired > 0 ? "danger" : "ok"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Submissions per day"
          subtitle={`${from} → ${to}`}
        >
          <ModuleActivity data={series} />
        </Card>

        <Card title="Who updated" subtitle={RANGE_LABEL[range]}>
          {people.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nobody has submitted in this period.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {people.slice(0, 10).map((p) => (
                <li key={p.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <Badge tone="muted">{p.count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {staleBoxes > 0 && (
        <Link
          href="/admin/first-aid"
          className="mt-4 flex items-center gap-3 rounded-card border border-border bg-warn-soft p-4 text-warn transition hover:opacity-90"
        >
          <TriangleAlert size={20} className="shrink-0" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            {neverChecked > 0 && staleChecked > 0
              ? `${neverChecked} first aid box(es) have never been checked and ${staleChecked} are 90+ days old.`
              : neverChecked > 0
                ? `${neverChecked} of ${boxes.length} first aid box(es) have never been checked.`
                : `${staleChecked} first aid box(es) have not been checked in 90+ days.`}
          </span>
          <ArrowRight size={18} className="shrink-0" />
        </Link>
      )}

      <Card className="mt-4" title="Recent activity" subtitle={RANGE_LABEL[range]}>
        <ActivityFeed rows={activity} />
      </Card>
    </div>
  );
}
