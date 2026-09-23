import { Briefcase, PackagePlus, TriangleAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RangeToggle } from "@/components/dashboard/RangeToggle";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { DataTable } from "@/components/dashboard/DataTable";
import { TrendBar } from "@/components/charts/TrendBar";
import { RankedBar } from "@/components/charts/RankedBar";
import { Badge, Card } from "@/components/ui";
import {
  getActivity, getBoxStatus, getDailyCounts, getTopRefilledItems, summarisePeople,
} from "@/lib/queries";
import { fmtDateTime, parseRange, RANGE_LABEL } from "@/lib/dates";
import { boxTone, type Activity, type BoxStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FirstAidDash({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);

  const [activity, boxes, counts, refilled] = await Promise.all([
    getActivity(range, "first_aid"),
    getBoxStatus(),
    getDailyCounts("first_aid", range),
    getTopRefilledItems(range),
  ]);

  const people = summarisePeople(activity);
  const touched = new Set(activity.map((a) => a.ref_label)).size;
  const stale = boxes.filter((b) => b.days_since === null || b.days_since >= 90);
  const totalAdded = refilled.reduce((s, r) => s + Number(r.total_added), 0);

  const byFreshness = [...boxes].sort((a, b) => {
    if (a.days_since === null) return -1;
    if (b.days_since === null) return 1;
    return b.days_since - a.days_since;
  });

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="First Aid Boxes"
        subtitle="These boxes have no fixed inspection schedule, so nothing is “overdue”. Freshness below is advisory."
        action={<RangeToggle value={range} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Boxes checked" value={`${touched}/${boxes.length}`}
          sub={RANGE_LABEL[range].toLowerCase()} icon={Briefcase} tone="info"
        />
        <KpiTile
          label="People who updated" value={people.length}
          sub={RANGE_LABEL[range].toLowerCase()} icon={Users} tone="primary"
        />
        <KpiTile
          label="Items refilled" value={totalAdded}
          sub="units added" icon={PackagePlus} tone="ok"
        />
        <KpiTile
          label="Not checked 90+ days" value={stale.length}
          sub="needs attention" icon={TriangleAlert}
          tone={stale.length > 0 ? "danger" : "ok"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Checks per day" subtitle={RANGE_LABEL[range]}>
          <TrendBar data={counts} unit="checks" />
        </Card>
        <Card
          title="Most refilled items"
          subtitle="What the plant actually consumes — use this for procurement"
        >
          <RankedBar
            data={refilled.map((r) => ({
              label: r.name_en.length > 24 ? r.name_en.slice(0, 22) + "…" : r.name_en,
              value: Number(r.total_added),
              sub: [r.spec, `${r.times} refill(s)`].filter(Boolean).join(" · "),
            }))}
            unit="units added"
            empty="No refills recorded in this period."
            color="var(--chart-3)"
          />
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Who updated"
        subtitle={`${RANGE_LABEL[range]} · ${activity.length} submission(s)`}
      >
        <DataTable<Activity>
          rows={activity}
          rowKey={(r) => r.record_id}
          columns={[
            { key: "p", header: "Person", cell: (r) => <span className="font-medium">{r.person}</span> },
            { key: "b", header: "Box", cell: (r) => r.ref_label },
            {
              key: "s", header: "Result",
              cell: (r) => (
                <Badge tone={r.detail === "refilled" ? "info" : r.detail === "issue" ? "warn" : "ok"}>
                  {r.detail}
                </Badge>
              ),
            },
            { key: "r", header: "Remarks", cell: (r) => <span className="text-muted">{r.remarks ?? "—"}</span> },
            { key: "t", header: "When", cell: (r) => <span className="whitespace-nowrap text-muted">{fmtDateTime(r.at)}</span> },
          ]}
        />
      </Card>

      <Card
        className="mt-4"
        title="Box freshness"
        subtitle="All 41 boxes, oldest check first"
      >
        <DataTable<BoxStatus>
          rows={byFreshness}
          rowKey={(r) => r.box_id}
          empty="No boxes configured."
          columns={[
            { key: "n", header: "Box", cell: (r) => <span className="font-semibold tabular-nums">{r.box_no}</span> },
            { key: "l", header: "Location", cell: (r) => r.location },
            {
              key: "a", header: "First aider",
              cell: (r) => (
                <span>
                  {r.first_aider_name ?? <span className="text-muted">Not assigned</span>}
                  {r.first_aider_mobile && (
                    <span className="block text-xs text-muted">{r.first_aider_mobile}</span>
                  )}
                </span>
              ),
            },
            {
              key: "d", header: "Last checked",
              cell: (r) =>
                r.last_checked_at ? (
                  <span>
                    {fmtDateTime(r.last_checked_at)}
                    <span className="block text-xs text-muted">by {r.last_checked_by}</span>
                  </span>
                ) : (
                  <span className="text-muted">Never</span>
                ),
            },
            {
              key: "s", header: "Age",
              cell: (r) => (
                <Badge tone={boxTone(r.days_since)}>
                  {r.days_since === null ? "Never checked" : `${r.days_since}d ago`}
                </Badge>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
