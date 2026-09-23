import { Pill, TriangleAlert, CalendarClock, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RangeToggle } from "@/components/dashboard/RangeToggle";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { DataTable } from "@/components/dashboard/DataTable";
import { MonthlyProgress } from "@/components/dashboard/MonthlyProgress";
import { SeverityStack, type SevRow } from "@/components/charts/SeverityStack";
import { Badge, Card } from "@/components/ui";
import { getActivity, getMedicineMonthly, getMedicineStatus, summarisePeople } from "@/lib/queries";
import { fmtDate, fmtDateTime, istToday, parseRange, RANGE_LABEL } from "@/lib/dates";
import { EXPIRY_META, type MedicineStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MedicineDash({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const year = Number(istToday().slice(0, 4));

  const [meds, activity, monthly] = await Promise.all([
    getMedicineStatus(),
    getActivity(range, "medicine"),
    getMedicineMonthly(year),
  ]);

  const people = summarisePeople(activity);
  const expired = meds.filter((m) => m.expiry_status === "expired");
  const nil = meds.filter((m) => m.expiry_status === "out_of_stock");
  const exp30 = meds.filter((m) => m.expiry_status === "expiring_30");
  const exp90 = meds.filter((m) => m.expiry_status === "expiring_90");
  const never = meds.filter((m) => m.expiry_status === "never_checked");

  // Three buckets for the chart — see SeverityStack for why 90-day is not
  // a segment. It is listed in the alerts table below instead.
  const byCategory = new Map<string, SevRow>();
  meds.forEach((m) => {
    const row =
      byCategory.get(m.category) ??
      { category: m.category, valid: 0, expiring: 0, expired: 0, unknown: 0 };
    if (m.expiry_status === "expired" || m.expiry_status === "out_of_stock") row.expired += 1;
    else if (m.expiry_status === "expiring_30") row.expiring += 1;
    else if (m.expiry_status === "valid" || m.expiry_status === "expiring_90") row.valid += 1;
    else row.unknown += 1;
    byCategory.set(m.category, row);
  });

  const alerts = [...expired, ...nil, ...exp30, ...exp90].sort((a, b) => {
    if (a.expiry_date === null) return 1;
    if (b.expiry_date === null) return -1;
    return a.expiry_date < b.expiry_date ? -1 : 1;
  });

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="OHC Medicines"
        subtitle={`${meds.length} items across ${byCategory.size} categories. Expiry status is calculated live from the recorded dates.`}
        action={<RangeToggle value={range} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Expired" value={expired.length} sub="remove from stock"
          icon={TriangleAlert} tone={expired.length > 0 ? "danger" : "ok"}
        />
        <KpiTile
          label="Expiring ≤30 days" value={exp30.length} sub="reorder now"
          icon={CalendarClock} tone={exp30.length > 0 ? "warn" : "ok"}
        />
        <KpiTile
          label="Never recorded" value={never.length}
          sub={`of ${meds.length} items`} icon={Pill}
          tone={never.length > 0 ? "muted" : "ok"}
        />
        <KpiTile
          label="Staff who updated" value={people.length}
          sub={RANGE_LABEL[range].toLowerCase()} icon={Users} tone="primary"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Stock health by category" subtitle="Current status of all items">
          <SeverityStack data={[...byCategory.values()]} />
        </Card>
        <Card
          title={`Monthly verification — ${year}`}
          subtitle="Mirrors the JAN–DEC columns of the paper register"
        >
          <MonthlyProgress data={monthly} year={year} />
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Action list"
        subtitle="Expired, out of stock, and expiring within 90 days — soonest first"
      >
        <DataTable<MedicineStatus>
          rows={alerts}
          rowKey={(r) => r.medicine_id}
          empty="Nothing expiring in the next 90 days. Stock is healthy."
          columns={[
            { key: "n", header: "Medicine", cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: "c", header: "Category", cell: (r) => <span className="text-muted">{r.category}</span> },
            { key: "q", header: "Qty", cell: (r) => <span className="tabular-nums">{r.qty ?? "—"}</span> },
            { key: "e", header: "Expiry", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.expiry_date)}</span> },
            {
              key: "s", header: "Status",
              cell: (r) => (
                <Badge tone={EXPIRY_META[r.expiry_status].tone}>
                  {EXPIRY_META[r.expiry_status].label}
                  {r.days_to_expiry !== null && r.days_to_expiry >= 0 && ` · ${r.days_to_expiry}d`}
                </Badge>
              ),
            },
            {
              key: "b", header: "Last checked",
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
          ]}
        />
      </Card>

      <Card
        className="mt-4"
        title="All medicines"
        subtitle={`${meds.length} items · current status`}
      >
        <DataTable<MedicineStatus>
          rows={meds}
          rowKey={(r) => r.medicine_id}
          columns={[
            { key: "n", header: "Medicine", cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: "c", header: "Category", cell: (r) => <span className="text-muted">{r.category}</span> },
            { key: "q", header: "Qty", cell: (r) => <span className="tabular-nums">{r.qty ?? "—"}</span> },
            { key: "e", header: "Expiry", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.expiry_date)}</span> },
            {
              key: "s", header: "Status",
              cell: (r) => (
                <Badge tone={EXPIRY_META[r.expiry_status].tone}>
                  {EXPIRY_META[r.expiry_status].label}
                </Badge>
              ),
            },
            { key: "b", header: "By", cell: (r) => <span className="text-muted">{r.last_checked_by ?? "—"}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
