import "server-only";
import { randomUUID } from "node:crypto";
import { appendRows, readTabs, toObjects } from "./sheets-client";
import {
  FIRST_AID_META, MEDICINE_META, VEHICLE_META, TAB, OK_MARK, FAIL_MARK, NIL_MARK,
  itemAddedHeader, itemFoundHeader, leadingIndex, pointHeader,
  medicineExpiryHeader, medicineQtyHeader,
} from "./sheets-schema";
import { istDate, istToday, addDays } from "@/lib/dates";
import { BadRequest } from "@/lib/api";
import type {
  Activity, BoxPublic, BoxStatus, CheckPoint, ExpiryStatus, FirstAidItem,
  Medicine, MedicineStatus, Module, ShiftCompliance, Vehicle,
} from "@/lib/types";
import type {
  AmbulanceInput, DashboardRange, ExportBundle, FailingPoint, FirstAidInput,
  MedicineInput, MonthRow, MonthlyProgress, Reference, RefillTotal,
} from "./contract";

/* ------------------------------------------------------------------ */
/* Caching                                                             */
/* ------------------------------------------------------------------ */
/* Sheets allows ~60 reads/minute/user. A dashboard page touches several
   tabs, and navigating between the four pages would blow through that
   in seconds. Reference data changes almost never; submissions change
   often but not sub-second. Two TTLs, one batched read.               */

type Grid = Record<string, string[][]>;
const REF_TTL = 5 * 60_000;
const TX_TTL = 10_000;

let refCache: { at: number; data: Grid } | null = null;
let txCache: { at: number; data: Grid } | null = null;

async function reference(force = false): Promise<Grid> {
  if (!force && refCache && Date.now() - refCache.at < REF_TTL) return refCache.data;
  const data = await readTabs([
    TAB.box, TAB.item, TAB.vehicle, TAB.point, TAB.medicineMaster,
  ]);
  refCache = { at: Date.now(), data };
  return data;
}

async function transactions(force = false): Promise<Grid> {
  if (!force && txCache && Date.now() - txCache.at < TX_TTL) return txCache.data;
  const data = await readTabs([TAB.firstAid, TAB.ambulance, TAB.medicine]);
  txCache = { at: Date.now(), data };
  return data;
}

/** Called after every write so the next read reflects it immediately. */
function invalidateTransactions() {
  txCache = null;
}

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

const truthy = (v: string | undefined) =>
  v === undefined || v === "" || /^(true|yes|1)$/i.test(v);

export async function getReference(): Promise<Reference> {
  const g = await reference();

  const boxes: BoxPublic[] = toObjects(g[TAB.box])
    .filter((r) => truthy(r.active))
    .map((r) => ({
      id: r.id,
      box_no: Number(r.box_no),
      location: r.location,
      first_aider_name: r.first_aider || null,
    }))
    .sort((a, b) => a.box_no - b.box_no);

  const items: FirstAidItem[] = toObjects(g[TAB.item])
    .map((r) => ({
      id: r.id,
      sr_no: Number(r.sr_no),
      name_en: r.name_en,
      name_hi: r.name_hi || null,
      spec: r.spec || null,
      standard_qty: Number(r.standard_qty) || 1,
    }))
    .sort((a, b) => a.sr_no - b.sr_no);

  const vehicles: Vehicle[] = toObjects(g[TAB.vehicle])
    .filter((r) => truthy(r.active))
    .map((r) => ({
      id: r.id,
      vehicle_no: r.vehicle_no,
      label: r.label,
      insurance_valid_until: r.insurance_valid_until || null,
    }));

  const points: CheckPoint[] = toObjects(g[TAB.point])
    .filter((r) => truthy(r.active))
    .map((r) => ({
      id: r.id,
      sort_order: Number(r.sort_order),
      label_hi: r.label_hi,
      label_en: r.label_en,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const medicines: Medicine[] = toObjects(g[TAB.medicineMaster])
    .filter((r) => truthy(r.active))
    .map((r) => ({
      id: r.id,
      sort_order: Number(r.sort_order),
      category: r.category,
      name: r.name,
      unit: r.unit || null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  return { boxes, items, vehicles, points, medicines, error: null };
}

/* ------------------------------------------------------------------ */
/* Wide-row helpers                                                    */
/* ------------------------------------------------------------------ */

function firstAidHeaderRow(items: FirstAidItem[]): string[] {
  return [
    ...FIRST_AID_META,
    ...items.flatMap((i) => [
      itemFoundHeader(i.sr_no, i.name_en, i.spec),
      itemAddedHeader(i.sr_no, i.name_en, i.spec),
    ]),
  ];
}

function medicineHeaderRow(medicines: Medicine[]): string[] {
  return [
    ...MEDICINE_META,
    ...medicines.flatMap((m) => [
      medicineQtyHeader(m.sort_order, m.name),
      medicineExpiryHeader(m.sort_order, m.name),
    ]),
  ];
}

function vehicleHeaderRow(points: CheckPoint[]): string[] {
  return [
    ...VEHICLE_META,
    ...points.map((p) => pointHeader(p.sort_order, p.label_hi, p.label_en)),
    "issues",
  ];
}

/* ------------------------------------------------------------------ */
/* Writes — append only                                                */
/* ------------------------------------------------------------------ */

export async function submitFirstAid(input: FirstAidInput): Promise<{ id: string }> {
  const { boxes, items } = await getReference();
  const box = boxes.find((b) => b.id === input.box_id);
  if (!box) throw new BadRequest("That first aid box no longer exists. Reload the form.");

  const byItem = new Map(input.items.map((i) => [i.item_id, i]));
  const totalFound = input.items.reduce((s, i) => s + i.qty_found, 0);
  const totalAdded = input.items.reduce((s, i) => s + i.qty_added, 0);
  const status = totalAdded > 0 ? "refilled" : input.remarks ? "issue" : "ok";

  const now = new Date();
  const id = randomUUID();
  const row = [
    istDate(now),
    now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }),
    box.box_no,
    box.location,
    input.checked_by_name,
    status,
    totalFound,
    totalAdded,
    input.remarks ?? "",
    now.toISOString(),
    id,
    ...items.flatMap((i) => {
      const l = byItem.get(i.id);
      return [l ? l.qty_found : "", l ? l.qty_added : ""];
    }),
  ];

  await appendRows(TAB.firstAid, [row]);
  invalidateTransactions();
  return { id };
}

export async function submitAmbulance(
  input: AmbulanceInput
): Promise<{ id: string } | { duplicate: true }> {
  const { vehicles, points } = await getReference();
  const vehicle = vehicles.find((v) => v.id === input.vehicle_id);
  if (!vehicle) throw new BadRequest("That vehicle no longer exists. Reload the form.");

  // Best effort only: Sheets has no unique constraint, so two submissions
  // racing on the same shift can both land. Reads dedupe (latest wins), so a
  // race produces a superseded row rather than a double count.
  const existing = await getVehicleChecks();
  if (
    existing.some(
      (r) =>
        r.vehicle_no === vehicle.vehicle_no &&
        r.check_date === input.check_date &&
        r.shift === input.shift
    )
  ) {
    return { duplicate: true };
  }

  const byPoint = new Map(input.results.map((r) => [r.point_id, r]));
  const issues = points
    .filter((p) => byPoint.get(p.id)?.is_ok === false)
    .map((p) => {
      const n = byPoint.get(p.id)?.note;
      return n ? `${p.label_en}: ${n}` : p.label_en;
    });

  const id = randomUUID();
  const row = [
    input.check_date,
    input.shift,
    vehicle.vehicle_no,
    vehicle.label,
    input.driver_name,
    input.staff_name ?? "",
    input.licence_no ?? "",
    input.licence_valid_until ?? "",
    input.remarks ?? "",
    new Date().toISOString(),
    id,
    ...points.map((p) => {
      const r = byPoint.get(p.id);
      return r === undefined ? "" : r.is_ok ? OK_MARK : FAIL_MARK;
    }),
    issues.join(" | "),
  ];

  await appendRows(TAB.ambulance, [row]);
  invalidateTransactions();
  return { id };
}

export async function saveMedicine(input: MedicineInput): Promise<{ saved: number }> {
  const { medicines } = await getReference();
  const byId = new Map(input.rows.map((r) => [r.medicine_id, r]));
  const known = new Set(medicines.map((m) => m.id));
  for (const r of input.rows) {
    if (!known.has(r.medicine_id)) {
      throw new BadRequest("The medicine list has changed. Reload the form and submit again.");
    }
  }

  const now = new Date();
  const [y, m] = input.period_month.split("-");
  const monthLabel = `${MONTH_NAMES[Number(m) - 1]} ${y}`;

  // One row per submission, every medicine in sequence across the columns.
  // Appending rather than editing the month's existing row means two people
  // submitting at once cannot overwrite each other; reads take the latest.
  const row: (string | number)[] = [
    input.period_month,
    monthLabel,
    input.checked_by_name,
    input.rows.length,
    input.remarks ?? "",
    now.toISOString(),
    randomUUID(),
    ...medicines.flatMap((med) => {
      const r = byId.get(med.id);
      if (!r) return ["", ""];
      if (r.stock_state === "out_of_stock") return [NIL_MARK, ""];
      return [r.qty ?? "", r.expiry_date ?? ""];
    }),
  ];

  await appendRows(TAB.medicine, [row]);
  invalidateTransactions();
  return { saved: input.rows.length };
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ------------------------------------------------------------------ */
/* Normalised reads (dedupe happens here)                              */
/* ------------------------------------------------------------------ */

type FirstAidRow = {
  id: string; check_date: string; checked_at: string; box_no: number;
  location: string; checked_by: string; status: string; remarks: string;
  total_added: number; perItem: Map<number, { found: number; added: number }>;
};

async function getFirstAidChecks(): Promise<FirstAidRow[]> {
  const grid = (await transactions())[TAB.firstAid] ?? [];
  if (grid.length < 2) return [];
  const [header, ...rows] = grid;
  const col = (n: string) => header.indexOf(n);

  const foundCols: { sr: number; i: number }[] = [];
  const addedCols: { sr: number; i: number }[] = [];
  header.forEach((h, i) => {
    const sr = leadingIndex(h);
    if (sr === null) return;
    if (h.endsWith("— found")) foundCols.push({ sr, i });
    else if (h.endsWith("— added")) addedCols.push({ sr, i });
  });

  return rows
    .filter((r) => r[col("id")])
    .map((r) => {
      const perItem = new Map<number, { found: number; added: number }>();
      foundCols.forEach(({ sr, i }) =>
        perItem.set(sr, { found: Number(r[i]) || 0, added: 0 })
      );
      addedCols.forEach(({ sr, i }) => {
        const e = perItem.get(sr) ?? { found: 0, added: 0 };
        e.added = Number(r[i]) || 0;
        perItem.set(sr, e);
      });
      return {
        id: r[col("id")],
        check_date: r[col("check_date")] ?? "",
        checked_at: r[col("checked_at")] ?? "",
        box_no: Number(r[col("box_no")]) || 0,
        location: r[col("location")] ?? "",
        checked_by: r[col("checked_by")] ?? "",
        status: r[col("status")] ?? "ok",
        remarks: r[col("remarks")] ?? "",
        total_added: Number(r[col("total_added")]) || 0,
        perItem,
      };
    });
}

type VehicleRow = {
  id: string; check_date: string; shift: string; vehicle_no: string;
  vehicle: string; driver_name: string; staff_name: string; licence_no: string;
  remarks: string; submitted_at: string; issues: string;
  perPoint: Map<number, boolean>;
};

async function getVehicleChecks(): Promise<VehicleRow[]> {
  const grid = (await transactions())[TAB.ambulance] ?? [];
  if (grid.length < 2) return [];
  const [header, ...rows] = grid;
  const col = (n: string) => header.indexOf(n);
  const pointCols: { order: number; i: number }[] = [];
  header.forEach((h, i) => {
    const o = leadingIndex(h);
    if (o !== null) pointCols.push({ order: o, i });
  });

  const parsed = rows
    .filter((r) => r[col("id")])
    .map((r) => {
      const perPoint = new Map<number, boolean>();
      pointCols.forEach(({ order, i }) => {
        const v = (r[i] ?? "").trim();
        if (v) perPoint.set(order, v !== FAIL_MARK);
      });
      return {
        id: r[col("id")],
        check_date: r[col("check_date")] ?? "",
        shift: r[col("shift")] ?? "",
        vehicle_no: r[col("vehicle_no")] ?? "",
        vehicle: r[col("vehicle")] ?? "",
        driver_name: r[col("driver_name")] ?? "",
        staff_name: r[col("staff_name")] ?? "",
        licence_no: r[col("licence_no")] ?? "",
        remarks: r[col("remarks")] ?? "",
        submitted_at: r[col("submitted_at")] ?? "",
        issues: r[col("issues")] ?? "",
        perPoint,
      };
    });

  // Latest wins per vehicle+date+shift — the substitute for a unique index.
  const best = new Map<string, VehicleRow>();
  parsed.forEach((r) => {
    const k = `${r.vehicle_no}|${r.check_date}|${r.shift}`;
    const cur = best.get(k);
    if (!cur || r.submitted_at > cur.submitted_at) best.set(k, r);
  });
  return [...best.values()];
}

type MedicineRow = {
  id: string; period_month: string; medicine_id: string; category: string;
  medicine: string; qty: number | null; expiry_date: string | null;
  stock_state: string; checked_by: string; checked_at: string; remarks: string;
};

/** One submitted row of the medicine register, before expansion. */
type MedicineSubmission = {
  id: string; period_month: string; month: string; checked_by: string;
  recorded: number; remarks: string; checked_at: string;
};

/** Every submitted row, newest first. Each submission is its own act — a
 *  correction is a second check by a second person, and the activity feed
 *  should show both. Values are merged separately in getMedicineChecks(). */
async function getMedicineSubmissions(): Promise<MedicineSubmission[]> {
  const grid = (await transactions())[TAB.medicine] ?? [];
  if (grid.length < 2) return [];
  const [header, ...rows] = grid;
  const col = (n: string) => header.indexOf(n);

  const parsed = rows
    .filter((r) => r[col("id")])
    .map((r) => ({
      id: r[col("id")],
      period_month: r[col("period_month")] ?? "",
      month: r[col("month")] ?? "",
      checked_by: r[col("checked_by")] ?? "",
      recorded: Number(r[col("recorded")]) || 0,
      remarks: r[col("remarks")] ?? "",
      checked_at: r[col("checked_at")] ?? "",
    }));

  return parsed.sort((a, b) => (a.checked_at < b.checked_at ? 1 : -1));
}

/** Expands each month's latest wide row into one record per medicine that
 *  actually carries a value. Blank column pairs mean "not checked". */
async function getMedicineChecks(): Promise<MedicineRow[]> {
  const grid = (await transactions())[TAB.medicine] ?? [];
  if (grid.length < 2) return [];
  const [header, ...rows] = grid;
  const col = (n: string) => header.indexOf(n);
  const { medicines } = await getReference();
  const byOrder = new Map(medicines.map((m) => [m.sort_order, m]));

  const qtyCols: { order: number; i: number }[] = [];
  const expCols: { order: number; i: number }[] = [];
  header.forEach((h, i) => {
    const order = leadingIndex(h);
    if (order === null) return;
    if (h.endsWith("— qty")) qtyCols.push({ order, i });
    else if (h.endsWith("— expiry")) expCols.push({ order, i });
  });
  const expByOrder = new Map(expCols.map((c) => [c.order, c.i]));

  // Merge every submission for a month, oldest first, so a later value
  // overwrites an earlier one for the SAME medicine and leaves the rest
  // alone. Taking only the newest row would silently drop everything a
  // correction did not happen to re-enter.
  const byMonth = new Map<string, string[][]>();
  rows
    .filter((r) => r[col("id")])
    .sort((a, b) => (a[col("checked_at")] ?? "").localeCompare(b[col("checked_at")] ?? ""))
    .forEach((r) => {
      const month = r[col("period_month")] ?? "";
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(r);
    });

  const out: MedicineRow[] = [];
  byMonth.forEach((monthRows, month) => {
    const merged = new Map<number, MedicineRow>();
    monthRows.forEach((r) => {
      qtyCols.forEach(({ order, i }) => {
        const med = byOrder.get(order);
        if (!med) return;
        const rawQty = (r[i] ?? "").toString().trim();
        const expIdx = expByOrder.get(order);
        const rawExp = expIdx === undefined ? "" : (r[expIdx] ?? "").toString().trim();
        if (!rawQty && !rawExp) return; // this submission did not touch it

        const nil = rawQty.toUpperCase() === NIL_MARK;
        merged.set(order, {
          id: `${r[col("id")]}:${order}`,
          period_month: month,
          medicine_id: med.id,
          category: med.category,
          medicine: med.name,
          qty: nil ? 0 : rawQty === "" ? null : Number(rawQty),
          expiry_date: rawExp || null,
          stock_state: nil ? "out_of_stock" : "in_stock",
          checked_by: r[col("checked_by")] ?? "",
          checked_at: r[col("checked_at")] ?? "",
          remarks: r[col("remarks")] ?? "",
        });
      });
    });
    out.push(...merged.values());
  });
  return out;
}

export async function getMedicineMonth(month: string): Promise<MonthRow[]> {
  return (await getMedicineChecks())
    .filter((r) => r.period_month === month)
    .map((r) => ({
      medicine_id: r.medicine_id,
      qty: r.qty,
      expiry_date: r.expiry_date,
      stock_state: r.stock_state,
    }));
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

const inRange = (d: string, r: DashboardRange) => d >= r.from && d <= r.to;

export async function getActivity(r: DashboardRange, module?: Module): Promise<Activity[]> {
  const [fa, vc, ms] = await Promise.all([
    getFirstAidChecks(), getVehicleChecks(), getMedicineSubmissions(),
  ]);
  const out: Activity[] = [];

  if (!module || module === "first_aid") {
    fa.forEach((c) => {
      if (!inRange(c.check_date, r)) return;
      out.push({
        module: "first_aid", record_id: c.id, person: c.checked_by,
        at: c.checked_at, on_date: c.check_date,
        ref_label: `Box ${c.box_no} — ${c.location}`,
        detail: c.status, remarks: c.remarks || null,
      });
    });
  }
  if (!module || module === "ambulance") {
    vc.forEach((c) => {
      // Dated by the shift it covers, not when it was keyed in. A shift
      // entered the next morning still belongs to its own day — otherwise
      // the trend chart disagrees with the compliance grid below it.
      const on = c.check_date;
      if (!inRange(on, r)) return;
      out.push({
        module: "ambulance", record_id: c.id, person: c.driver_name,
        at: c.submitted_at, on_date: on,
        ref_label: `${c.vehicle} (${c.vehicle_no}) — Shift ${c.shift}`,
        detail: `Shift ${c.shift}`, remarks: c.remarks || null,
      });
    });
  }
  if (!module || module === "medicine") {
    // One entry per submitted check, not per medicine — a monthly check is a
    // single act, and 99 feed entries would drown the other modules.
    ms.forEach((c) => {
      const on = c.checked_at ? istDate(c.checked_at) : c.period_month;
      if (!inRange(on, r)) return;
      out.push({
        module: "medicine", record_id: c.id, person: c.checked_by,
        at: c.checked_at, on_date: on,
        ref_label: `Medicine check — ${c.month}`,
        detail: `${c.recorded} recorded`, remarks: c.remarks || null,
      });
    });
  }

  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function getBoxStatus(): Promise<BoxStatus[]> {
  const g = await reference();
  const checks = await getFirstAidChecks();
  const today = istToday();

  const latest = new Map<number, FirstAidRow>();
  const counts = new Map<number, number>();
  checks.forEach((c) => {
    counts.set(c.box_no, (counts.get(c.box_no) ?? 0) + 1);
    const cur = latest.get(c.box_no);
    if (!cur || c.checked_at > cur.checked_at) latest.set(c.box_no, c);
  });

  return toObjects(g[TAB.box])
    .filter((r) => truthy(r.active))
    .map((r) => {
      const boxNo = Number(r.box_no);
      const l = latest.get(boxNo);
      return {
        box_id: r.id,
        box_no: boxNo,
        location: r.location,
        first_aider_name: r.first_aider || null,
        first_aider_mobile: r.first_aider_mobile || null,
        last_checked_by: l?.checked_by ?? null,
        last_checked_at: l?.checked_at ?? null,
        last_status: l?.status ?? null,
        days_since: l ? daysBetween(istDate(l.checked_at), today) : null,
        total_checks: counts.get(boxNo) ?? 0,
      };
    })
    .sort((a, b) => a.box_no - b.box_no);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

function expiryBucket(
  expiry: string | null, stock: string, checked: boolean, today: string
): ExpiryStatus {
  if (!checked) return "never_checked";
  if (stock === "out_of_stock") return "out_of_stock";
  if (!expiry) return "no_expiry_recorded";
  if (expiry < today) return "expired";
  if (expiry <= addDays(today, 30)) return "expiring_30";
  if (expiry <= addDays(today, 90)) return "expiring_90";
  return "valid";
}

export async function getMedicineStatus(): Promise<MedicineStatus[]> {
  const { medicines } = await getReference();
  const checks = await getMedicineChecks();
  const today = istToday();

  const latest = new Map<string, MedicineRow>();
  checks.forEach((c) => {
    const cur = latest.get(c.medicine_id);
    if (!cur || c.period_month > cur.period_month ||
        (c.period_month === cur.period_month && c.checked_at > cur.checked_at)) {
      latest.set(c.medicine_id, c);
    }
  });

  return medicines.map((m) => {
    const l = latest.get(m.id);
    return {
      medicine_id: m.id,
      sort_order: m.sort_order,
      category: m.category,
      name: m.name,
      unit: m.unit,
      qty: l?.qty ?? null,
      expiry_date: l?.expiry_date ?? null,
      stock_state: l?.stock_state ?? null,
      last_checked_by: l?.checked_by ?? null,
      last_checked_at: l?.checked_at ?? null,
      last_period: l?.period_month ?? null,
      remarks: l?.remarks || null,
      expiry_status: expiryBucket(
        l?.expiry_date ?? null, l?.stock_state ?? "in_stock", Boolean(l), today
      ),
      days_to_expiry: l?.expiry_date ? daysBetween(today, l.expiry_date) : null,
    };
  });
}

export async function getShiftCompliance(r: DashboardRange): Promise<ShiftCompliance[]> {
  const { vehicles } = await getReference();
  const checks = await getVehicleChecks();
  const out: ShiftCompliance[] = [];

  for (let d = r.to; d >= r.from; d = addDays(d, -1)) {
    for (const v of vehicles) {
      for (const shift of ["A", "B", "C"] as const) {
        const hit = checks.find(
          (c) => c.vehicle_no === v.vehicle_no && c.check_date === d && c.shift === shift
        );
        out.push({
          check_date: d,
          vehicle_id: v.id,
          vehicle_no: v.vehicle_no,
          vehicle_label: v.label,
          shift,
          done: Boolean(hit),
          driver_name: hit?.driver_name ?? null,
          staff_name: hit?.staff_name || null,
          failed_count: hit ? [...hit.perPoint.values()].filter((ok) => !ok).length : 0,
          remarks: hit?.remarks || null,
        });
      }
    }
  }
  return out;
}

export async function getFailingPoints(r: DashboardRange): Promise<FailingPoint[]> {
  const { points } = await getReference();
  const checks = (await getVehicleChecks()).filter((c) => inRange(c.check_date, r));

  return points
    .map((p) => {
      let fail = 0, total = 0;
      checks.forEach((c) => {
        const v = c.perPoint.get(p.sort_order);
        if (v === undefined) return;
        total += 1;
        if (!v) fail += 1;
      });
      return {
        point_id: p.id, label_en: p.label_en, label_hi: p.label_hi,
        fail_count: fail, total_count: total,
      };
    })
    .filter((p) => p.fail_count > 0)
    .sort((a, b) => b.fail_count - a.fail_count);
}

export async function getTopRefilledItems(r: DashboardRange): Promise<RefillTotal[]> {
  const { items } = await getReference();
  const checks = (await getFirstAidChecks()).filter((c) => inRange(c.check_date, r));

  return items
    .map((i) => {
      let total = 0, times = 0;
      checks.forEach((c) => {
        const added = c.perItem.get(i.sr_no)?.added ?? 0;
        if (added > 0) { total += added; times += 1; }
      });
      return {
        item_id: i.id, name_en: i.name_en, spec: i.spec,
        total_added: total, times,
      };
    })
    .filter((i) => i.total_added > 0)
    .sort((a, b) => b.total_added - a.total_added);
}

export async function getDailyCounts(
  module: Module, r: DashboardRange
): Promise<{ day: string; n: number }[]> {
  const activity = await getActivity(r, module);
  const byDay = new Map<string, number>();
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) byDay.set(d, 0);
  activity.forEach((a) => {
    if (byDay.has(a.on_date)) byDay.set(a.on_date, byDay.get(a.on_date)! + 1);
  });
  return [...byDay.entries()].map(([day, n]) => ({ day, n }));
}

export async function getMedicineMonthly(year: number): Promise<MonthlyProgress[]> {
  const { medicines } = await getReference();
  const checks = await getMedicineChecks();
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    return {
      month_no: i + 1,
      checked: checks.filter((c) => c.period_month === key).length,
      total: medicines.length,
    };
  });
}

export { medicineHeaderRow };

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export async function getExportData(
  r: DashboardRange, modules: string[]
): Promise<ExportBundle> {
  const { items, points } = await getReference();
  const bundle: ExportBundle = {
    firstAid: [], firstAidItems: [], ambulance: [], medicine: [],
    itemColumns: items.map((i) => ({ sr_no: i.sr_no, name_en: i.name_en, spec: i.spec, standard_qty: i.standard_qty })),
    pointColumns: points.map((p) => ({ sort_order: p.sort_order, label_hi: p.label_hi, label_en: p.label_en })),
  };

  if (modules.includes("first_aid")) {
    const checks = (await getFirstAidChecks())
      .filter((c) => inRange(c.check_date, r))
      .sort((a, b) => (a.checked_at < b.checked_at ? 1 : -1));
    checks.forEach((c) => {
      bundle.firstAid.push({
        check_date: c.check_date,
        time: c.checked_at
          ? new Date(c.checked_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })
          : "",
        box_no: c.box_no, location: c.location,
        checked_by: c.checked_by, status: c.status, remarks: c.remarks,
      });
      items.forEach((i) => {
        const l = c.perItem.get(i.sr_no);
        if (!l) return;
        bundle.firstAidItems.push({
          check_date: c.check_date, box_no: c.box_no, location: c.location,
          sr_no: i.sr_no, name_en: i.name_en, spec: i.spec,
          standard_qty: i.standard_qty, qty_found: l.found, qty_added: l.added,
        });
      });
    });
  }

  if (modules.includes("ambulance")) {
    (await getVehicleChecks())
      .filter((c) => inRange(c.check_date, r))
      .sort((a, b) =>
        a.check_date === b.check_date
          ? a.shift.localeCompare(b.shift)
          : a.check_date < b.check_date ? 1 : -1
      )
      .forEach((c) => {
        bundle.ambulance.push({
          check_date: c.check_date, shift: c.shift,
          vehicle: `${c.vehicle} (${c.vehicle_no})`,
          driver_name: c.driver_name, staff_name: c.staff_name,
          licence_no: c.licence_no,
          marks: points.map((p) => {
            const v = c.perPoint.get(p.sort_order);
            return v === undefined ? "" : v ? OK_MARK : FAIL_MARK;
          }),
          failedIndexes: points
            .map((p, idx) => (c.perPoint.get(p.sort_order) === false ? idx : -1))
            .filter((x) => x >= 0),
          remarks: [c.remarks, c.issues].filter(Boolean).join(" | "),
        });
      });
  }

  if (modules.includes("medicine")) {
    const today = istToday();
    (await getMedicineChecks())
      .filter((c) => c.period_month >= r.from.slice(0, 8) + "01" && c.period_month <= r.to)
      .sort((a, b) => (a.period_month < b.period_month ? 1 : -1))
      .forEach((c) => {
        bundle.medicine.push({
          period_month: c.period_month.slice(0, 7),
          category: c.category, name: c.medicine,
          qty: c.qty, expiry_date: c.expiry_date,
          stock_state: c.stock_state, checked_by: c.checked_by,
          checked_on: c.checked_at ? c.checked_at.slice(0, 10) : "",
          remarks: c.remarks,
          expired: Boolean(c.expiry_date && c.expiry_date < today),
        });
      });
  }

  return bundle;
}

export { firstAidHeaderRow, vehicleHeaderRow };
