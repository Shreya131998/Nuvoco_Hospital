import { Truck, TriangleAlert, CircleCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RangeToggle } from "@/components/dashboard/RangeToggle";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { DataTable } from "@/components/dashboard/DataTable";
import { ComplianceGrid } from "@/components/dashboard/ComplianceGrid";
import { RankedBar } from "@/components/charts/RankedBar";
import { TrendBar } from "@/components/charts/TrendBar";
import { Badge, Card } from "@/components/ui";
import {
  getDailyCounts, getFailingPoints, getShiftCompliance, getActivity, summarisePeople,
} from "@/lib/queries";
import { parseRange, RANGE_LABEL, istToday } from "@/lib/dates";
import type { ShiftCompliance } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AmbulanceDash({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);

  const [shifts, failing, counts, activity] = await Promise.all([
    getShiftCompliance(range),
    getFailingPoints(range),
    getDailyCounts("ambulance", range),
    getActivity(range, "ambulance"),
  ]);

  const done = shifts.filter((s) => s.done);
  const missed = shifts.filter((s) => !s.done);
  const pct = shifts.length ? Math.round((done.length / shifts.length) * 100) : 0;
  const totalIssues = done.reduce((s, r) => s + Number(r.failed_count), 0);
  const drivers = summarisePeople(activity);

  const today = istToday();
  const missedToday = missed.filter((s) => s.check_date === today);
  const submitted = done.sort((a, b) =>
    a.check_date === b.check_date
      ? a.shift.localeCompare(b.shift)
      : a.check_date < b.check_date ? 1 : -1
  );

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="Ambulance / Drivers"
        subtitle="Daily check, 3 shifts per vehicle. Missed shifts are shown in red."
        action={<RangeToggle value={range} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Shift compliance" value={`${pct}%`}
          sub={`${done.length} of ${shifts.length} shifts`} icon={CircleCheck}
          tone={pct >= 90 ? "ok" : pct >= 70 ? "warn" : "danger"}
        />
        <KpiTile
          label="Missed shifts" value={missed.length}
          sub={RANGE_LABEL[range].toLowerCase()} icon={Truck}
          tone={missed.length === 0 ? "ok" : "danger"}
        />
        <KpiTile
          label="Issues reported" value={totalIssues}
          sub="failed check points" icon={TriangleAlert}
          tone={totalIssues > 0 ? "warn" : "ok"}
        />
        <KpiTile
          label="Drivers who updated" value={drivers.length}
          sub={RANGE_LABEL[range].toLowerCase()} icon={Users} tone="primary"
        />
      </div>

      {missedToday.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-card border border-border bg-danger-soft p-4 text-danger">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm font-medium">
            Today’s shift{missedToday.length > 1 ? "s" : ""}{" "}
            {missedToday.map((s) => s.shift).join(", ")} not yet submitted
            {missedToday.length === 1 ? "" : ""} for{" "}
            {[...new Set(missedToday.map((s) => s.vehicle_label))].join(", ")}.
          </p>
        </div>
      )}

      <Card className="mt-4" title="Shift compliance" subtitle={RANGE_LABEL[range]}>
        <ComplianceGrid rows={shifts} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Checks submitted per day" subtitle={RANGE_LABEL[range]}>
          <TrendBar data={counts} unit="checks" color="var(--chart-2)" />
        </Card>
        <Card
          title="Most frequent failures"
          subtitle="Which part of the vehicle keeps failing — a maintenance signal"
        >
          <RankedBar
            data={failing.map((f) => ({
              label: f.label_en,
              value: Number(f.fail_count),
              sub: `${f.label_hi} · ${f.fail_count} of ${f.total_count} checks`,
            }))}
            unit="failures"
            empty="No failures reported in this period."
            color="var(--sev-bad)"
          />
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Submitted checks"
        subtitle={`${RANGE_LABEL[range]} · ${done.length} shift(s)`}
      >
        <DataTable<ShiftCompliance>
          rows={submitted}
          rowKey={(r, i) => `${r.vehicle_id}-${r.check_date}-${r.shift}-${i}`}
          empty="No shifts submitted in this period."
          columns={[
            { key: "d", header: "Date", cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.check_date}</span> },
            { key: "s", header: "Shift", cell: (r) => <span className="font-semibold">{r.shift}</span> },
            { key: "v", header: "Vehicle", cell: (r) => r.vehicle_label },
            { key: "n", header: "Driver", cell: (r) => <span className="font-medium">{r.driver_name}</span> },
            {
              key: "f", header: "Issues",
              cell: (r) =>
                Number(r.failed_count) > 0 ? (
                  <Badge tone="danger">{r.failed_count} not OK</Badge>
                ) : (
                  <Badge tone="ok">All OK</Badge>
                ),
            },
            { key: "r", header: "Remarks", cell: (r) => <span className="text-muted">{r.remarks ?? "—"}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
