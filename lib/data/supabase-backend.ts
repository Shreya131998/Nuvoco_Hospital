import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { istToday } from "@/lib/dates";
import type {
  Activity, BoxPublic, BoxStatus, CheckPoint, FirstAidItem, Medicine,
  MedicineStatus, Module, ShiftCompliance, Vehicle,
} from "@/lib/types";
import type {
  AmbulanceInput, Backend, DashboardRange, ExportBundle, FailingPoint,
  FirstAidInput, MedicineInput, MonthRow, MonthlyProgress, Reference, RefillTotal,
} from "./contract";

/** Postgres backend. Kept intact as the fallback if Sheets stops coping. */
export const supabaseBackend: Backend = {
  name: "supabase",

  isConfigured: () =>
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),

  async getReference(): Promise<Reference> {
    const sb = createAdminSupabase();
    const [boxes, items, vehicles, points, medicines] = await Promise.all([
      sb.from("v_box_public").select("*").order("box_no"),
      sb.from("first_aid_item").select("*").order("sr_no"),
      sb.from("vehicle").select("*").order("label"),
      sb.from("vehicle_check_point").select("*").order("sort_order"),
      sb.from("medicine").select("*").order("sort_order"),
    ]);
    return {
      boxes: (boxes.data ?? []) as BoxPublic[],
      items: (items.data ?? []) as FirstAidItem[],
      vehicles: (vehicles.data ?? []) as Vehicle[],
      points: (points.data ?? []) as CheckPoint[],
      medicines: (medicines.data ?? []) as Medicine[],
      error: boxes.error ?? items.error ??
             vehicles.error ?? points.error ?? medicines.error ?? null,
    };
  },

  async submitFirstAid(i: FirstAidInput) {
    const sb = createAdminSupabase();
    const added = i.items.reduce((s, x) => s + x.qty_added, 0);
    const status = added > 0 ? "refilled" : i.remarks ? "issue" : "ok";

    const { data: check, error } = await sb
      .from("first_aid_check")
      .insert({
        box_id: i.box_id,
        checked_by_name: i.checked_by_name,
        remarks: i.remarks,
        status,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (i.items.length) {
      const { error: e2 } = await sb.from("first_aid_check_item").insert(
        i.items.map((x) => ({
          check_id: check.id,
          item_id: x.item_id,
          qty_found: x.qty_found,
          qty_added: x.qty_added,
          is_ok: x.qty_found + x.qty_added > 0,
        }))
      );
      if (e2) {
        await sb.from("first_aid_check").delete().eq("id", check.id);
        throw e2;
      }
    }
    return { id: check.id as string };
  },

  async submitAmbulance(i: AmbulanceInput) {
    const sb = createAdminSupabase();
    const { data: check, error } = await sb
      .from("vehicle_check")
      .insert({
        vehicle_id: i.vehicle_id,
        check_date: i.check_date,
        shift: i.shift,
        driver_name: i.driver_name,
        licence_no: i.licence_no,
        licence_valid_until: i.licence_valid_until,
        staff_name: i.staff_name,
        remarks: i.remarks,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return { duplicate: true as const };
      throw error;
    }

    if (i.results.length) {
      const { error: e2 } = await sb
        .from("vehicle_check_result")
        .insert(i.results.map((r) => ({ ...r, check_id: check.id })));
      if (e2) {
        await sb.from("vehicle_check").delete().eq("id", check.id);
        throw e2;
      }
    }
    return { id: check.id as string };
  },

  async saveMedicine(i: MedicineInput) {
    const sb = createAdminSupabase();
    const now = new Date().toISOString();
    const rows = i.rows.map((r) => ({
      ...r,
      period_month: i.period_month,
      checked_by_name: i.checked_by_name,
      remarks: i.remarks,
      checked_at: now,
    }));
    if (!rows.length) return { saved: 0 };
    const { error } = await sb
      .from("medicine_check")
      .upsert(rows, { onConflict: "medicine_id,period_month" });
    if (error) throw error;
    return { saved: rows.length };
  },

  async getMedicineMonth(month: string): Promise<MonthRow[]> {
    const sb = createAdminSupabase();
    const { data, error } = await sb
      .from("medicine_check")
      .select("medicine_id, qty, expiry_date, stock_state")
      .eq("period_month", month);
    if (error) throw error;
    return (data ?? []) as MonthRow[];
  },

  async getActivity(r: DashboardRange, module?: Module): Promise<Activity[]> {
    const sb = createAdminSupabase();
    let q = sb.from("v_activity").select("*")
      .gte("on_date", r.from).lte("on_date", r.to)
      .order("at", { ascending: false }).limit(500);
    if (module) q = q.eq("module", module);
    const { data } = await q;
    return (data ?? []) as Activity[];
  },

  async getBoxStatus(): Promise<BoxStatus[]> {
    const sb = createAdminSupabase();
    const { data } = await sb.from("v_box_status").select("*").order("box_no");
    return (data ?? []) as BoxStatus[];
  },

  async getMedicineStatus(): Promise<MedicineStatus[]> {
    const sb = createAdminSupabase();
    const { data } = await sb.from("v_medicine_status").select("*").order("sort_order");
    return (data ?? []) as MedicineStatus[];
  },

  async getShiftCompliance(r: DashboardRange): Promise<ShiftCompliance[]> {
    const sb = createAdminSupabase();
    const { data } = await sb.rpc("shift_compliance", { p_from: r.from, p_to: r.to });
    return (data ?? []) as ShiftCompliance[];
  },

  async getFailingPoints(r: DashboardRange): Promise<FailingPoint[]> {
    const sb = createAdminSupabase();
    const { data } = await sb.rpc("failing_points", { p_from: r.from, p_to: r.to });
    return (data ?? []) as FailingPoint[];
  },

  async getTopRefilledItems(r: DashboardRange): Promise<RefillTotal[]> {
    const sb = createAdminSupabase();
    const { data } = await sb.rpc("top_refilled_items", { p_from: r.from, p_to: r.to });
    return (data ?? []) as RefillTotal[];
  },

  async getDailyCounts(m: Module, r: DashboardRange) {
    const sb = createAdminSupabase();
    const { data } = await sb.rpc("daily_counts", { p_module: m, p_from: r.from, p_to: r.to });
    return (data ?? []) as { day: string; n: number }[];
  },

  async getMedicineMonthly(year: number): Promise<MonthlyProgress[]> {
    const sb = createAdminSupabase();
    const { data } = await sb.rpc("medicine_monthly_progress", { p_year: year });
    return (data ?? []) as MonthlyProgress[];
  },

  async getExportData(r: DashboardRange, modules: string[]): Promise<ExportBundle> {
    const sb = createAdminSupabase();
    const today = istToday();

    const [{ data: items }, { data: points }] = await Promise.all([
      sb.from("first_aid_item").select("*").order("sr_no"),
      sb.from("vehicle_check_point").select("*").order("sort_order"),
    ]);

    const bundle: ExportBundle = {
      firstAid: [], firstAidItems: [], ambulance: [], medicine: [],
      itemColumns: (items ?? []).map((i) => ({
        sr_no: i.sr_no, name_en: i.name_en, spec: i.spec, standard_qty: i.standard_qty,
      })),
      pointColumns: (points ?? []).map((p) => ({
        sort_order: p.sort_order, label_hi: p.label_hi, label_en: p.label_en,
      })),
    };

    if (modules.includes("first_aid")) {
      const { data: checks } = await sb
        .from("first_aid_check")
        .select("id, check_date, checked_at, checked_by_name, status, remarks, first_aid_box(box_no, location)")
        .gte("check_date", r.from).lte("check_date", r.to)
        .order("checked_at", { ascending: false });

      const meta = new Map<string, { date: string; box: number; loc: string }>();
      (checks ?? []).forEach((c) => {
        const b = c.first_aid_box as unknown as { box_no: number; location: string } | null;
        meta.set(c.id, { date: c.check_date, box: b?.box_no ?? 0, loc: b?.location ?? "" });
        bundle.firstAid.push({
          check_date: c.check_date,
          time: c.checked_at
            ? new Date(c.checked_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })
            : "",
          box_no: b?.box_no ?? 0, location: b?.location ?? "",
          checked_by: c.checked_by_name, status: c.status, remarks: c.remarks ?? "",
        });
      });

      const ids = (checks ?? []).map((c) => c.id);
      if (ids.length) {
        const { data: lines } = await sb
          .from("first_aid_check_item")
          .select("check_id, qty_found, qty_added, first_aid_item(sr_no, name_en, spec, standard_qty)")
          .in("check_id", ids);
        (lines ?? []).forEach((l) => {
          const m = meta.get(l.check_id);
          const it = l.first_aid_item as unknown as
            { sr_no: number; name_en: string; spec: string | null; standard_qty: number } | null;
          bundle.firstAidItems.push({
            check_date: m?.date ?? "", box_no: m?.box ?? 0, location: m?.loc ?? "",
            sr_no: it?.sr_no ?? 0, name_en: it?.name_en ?? "", spec: it?.spec ?? null,
            standard_qty: it?.standard_qty ?? 0,
            qty_found: l.qty_found, qty_added: l.qty_added,
          });
        });
      }
    }

    if (modules.includes("ambulance")) {
      const { data: checks } = await sb
        .from("vehicle_check")
        .select("id, check_date, shift, driver_name, staff_name, licence_no, remarks, vehicle(vehicle_no, label)")
        .gte("check_date", r.from).lte("check_date", r.to)
        .order("check_date", { ascending: false }).order("shift");

      const ids = (checks ?? []).map((c) => c.id);
      const { data: results } = ids.length
        ? await sb.from("vehicle_check_result").select("check_id, point_id, is_ok, note").in("check_id", ids)
        : { data: [] };

      const byCheck = new Map<string, Map<string, { is_ok: boolean; note: string | null }>>();
      (results ?? []).forEach((x) => {
        if (!byCheck.has(x.check_id)) byCheck.set(x.check_id, new Map());
        byCheck.get(x.check_id)!.set(x.point_id, { is_ok: x.is_ok, note: x.note });
      });

      (checks ?? []).forEach((c) => {
        const veh = c.vehicle as unknown as { vehicle_no: string; label: string } | null;
        const map = byCheck.get(c.id);
        const notes: string[] = [];
        const marks: string[] = [];
        const failedIndexes: number[] = [];
        (points ?? []).forEach((p, idx) => {
          const x = map?.get(p.id);
          marks.push(x === undefined ? "" : x.is_ok ? "✓" : "✗");
          if (x && !x.is_ok) {
            failedIndexes.push(idx);
            if (x.note) notes.push(`${p.label_en}: ${x.note}`);
          }
        });
        bundle.ambulance.push({
          check_date: c.check_date, shift: c.shift,
          vehicle: veh ? `${veh.label} (${veh.vehicle_no})` : "",
          driver_name: c.driver_name,
          staff_name: c.staff_name ?? "",
          licence_no: c.licence_no ?? "",
          marks, failedIndexes,
          remarks: [c.remarks, ...notes].filter(Boolean).join(" | "),
        });
      });
    }

    if (modules.includes("medicine")) {
      const { data: rows } = await sb
        .from("medicine_check")
        .select("period_month, qty, expiry_date, stock_state, checked_by_name, checked_at, remarks, medicine(category, name)")
        .gte("period_month", r.from.slice(0, 8) + "01")
        .lte("period_month", r.to)
        .order("period_month", { ascending: false });

      (rows ?? []).forEach((x) => {
        const med = x.medicine as unknown as { category: string; name: string } | null;
        bundle.medicine.push({
          period_month: x.period_month?.slice(0, 7) ?? "",
          category: med?.category ?? "", name: med?.name ?? "",
          qty: x.qty, expiry_date: x.expiry_date, stock_state: x.stock_state,
          checked_by: x.checked_by_name, checked_on: x.checked_at?.slice(0, 10) ?? "",
          remarks: x.remarks ?? "",
          expired: Boolean(x.expiry_date && x.expiry_date < today),
        });
      });
    }

    return bundle;
  },
};
