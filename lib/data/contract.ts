import type {
  Activity, BoxPublic, BoxStatus, CheckPoint, FirstAidItem, Medicine,
  MedicineStatus, Module, ShiftCompliance, Vehicle,
} from "@/lib/types";

/** The surface every backend implements. Adding a backend means implementing
 *  this file's functions — nothing in app/ changes. */

export type DashboardRange = { from: string; to: string };

export type Reference = {
  boxes: BoxPublic[];
  items: FirstAidItem[];
  vehicles: Vehicle[];
  points: CheckPoint[];
  medicines: Medicine[];
  error: { message: string } | null;
};

export type FirstAidInput = {
  box_id: string;
  checked_by_name: string;
  remarks: string | null;
  items: { item_id: string; qty_found: number; qty_added: number }[];
};

export type AmbulanceInput = {
  vehicle_id: string;
  check_date: string;
  shift: "A" | "B" | "C";
  driver_name: string;
  /** OHC staff countersigning the check — स्टाफ के हस्ताक्षर on the paper form. */
  staff_name: string | null;
  licence_no: string | null;
  licence_valid_until: string | null;
  remarks: string | null;
  results: { point_id: string; is_ok: boolean; note: string | null }[];
};

export type MedicineInput = {
  period_month: string;
  checked_by_name: string;
  remarks: string | null;
  rows: {
    medicine_id: string;
    qty: number | null;
    expiry_date: string | null;
    stock_state: "in_stock" | "out_of_stock";
  }[];
};

export type MonthRow = {
  medicine_id: string;
  qty: number | null;
  expiry_date: string | null;
  stock_state: string;
};

export type FailingPoint = {
  point_id: string; label_en: string; label_hi: string;
  fail_count: number; total_count: number;
};

export type RefillTotal = {
  item_id: string; name_en: string; spec: string | null;
  total_added: number; times: number;
};

export type MonthlyProgress = { month_no: number; checked: number; total: number };

export type ExportBundle = {
  firstAid: {
    check_date: string; time: string; box_no: number; location: string;
    checked_by: string; status: string; remarks: string;
  }[];
  firstAidItems: {
    check_date: string; box_no: number; location: string; sr_no: number;
    name_en: string; spec: string | null; standard_qty: number;
    qty_found: number; qty_added: number;
  }[];
  ambulance: {
    check_date: string; shift: string; vehicle: string; driver_name: string;
    staff_name: string; licence_no: string; marks: string[];
    failedIndexes: number[]; remarks: string;
  }[];
  medicine: {
    period_month: string; category: string; name: string; qty: number | null;
    expiry_date: string | null; stock_state: string; checked_by: string;
    checked_on: string; remarks: string; expired: boolean;
  }[];
  itemColumns: { sr_no: number; name_en: string; spec: string | null; standard_qty: number }[];
  pointColumns: { sort_order: number; label_hi: string; label_en: string }[];
};

export interface Backend {
  name: "sheets" | "supabase";
  isConfigured(): boolean;
  getReference(): Promise<Reference>;
  submitFirstAid(i: FirstAidInput): Promise<{ id: string }>;
  submitAmbulance(i: AmbulanceInput): Promise<{ id: string } | { duplicate: true }>;
  saveMedicine(i: MedicineInput): Promise<{ saved: number }>;
  getMedicineMonth(month: string): Promise<MonthRow[]>;
  getActivity(r: DashboardRange, m?: Module): Promise<Activity[]>;
  getBoxStatus(): Promise<BoxStatus[]>;
  getMedicineStatus(): Promise<MedicineStatus[]>;
  getShiftCompliance(r: DashboardRange): Promise<ShiftCompliance[]>;
  getFailingPoints(r: DashboardRange): Promise<FailingPoint[]>;
  getTopRefilledItems(r: DashboardRange): Promise<RefillTotal[]>;
  getDailyCounts(m: Module, r: DashboardRange): Promise<{ day: string; n: number }[]>;
  getMedicineMonthly(year: number): Promise<MonthlyProgress[]>;
  getExportData(r: DashboardRange, modules: string[]): Promise<ExportBundle>;
}
