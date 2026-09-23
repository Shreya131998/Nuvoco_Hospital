export type Module = "first_aid" | "ambulance" | "medicine";

export const MODULE_LABEL: Record<Module, string> = {
  first_aid: "First Aid Boxes",
  ambulance: "Ambulance / Driver",
  medicine: "OHC Medicines",
};

export type Shift = "A" | "B" | "C";
export const SHIFTS: Shift[] = ["A", "B", "C"];

/** Shift windows as run by the plant, shown on the form so the driver picks the right one. */
export const SHIFT_TIME: Record<Shift, string> = {
  A: "06:00 – 14:00",
  B: "14:00 – 22:00",
  C: "22:00 – 06:00",
};

export type StaffPublic = { id: string; name: string; role: string };

export type BoxPublic = {
  id: string;
  box_no: number;
  location: string;
  first_aider_name: string | null;
};

export type FirstAidItem = {
  id: string;
  sr_no: number;
  name_en: string;
  name_hi: string | null;
  spec: string | null;
  standard_qty: number;
};

export type Vehicle = {
  id: string;
  vehicle_no: string;
  label: string;
  insurance_valid_until: string | null;
};

export type CheckPoint = {
  id: string;
  sort_order: number;
  label_hi: string;
  label_en: string;
};

export type Medicine = {
  id: string;
  sort_order: number;
  category: string;
  name: string;
  unit: string | null;
};

export type ExpiryStatus =
  | "valid"
  | "expiring_90"
  | "expiring_30"
  | "expired"
  | "out_of_stock"
  | "no_expiry_recorded"
  | "never_checked";

export const EXPIRY_META: Record<
  ExpiryStatus,
  { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }
> = {
  valid:              { label: "Valid",            tone: "ok" },
  expiring_90:        { label: "Expires ≤ 90d",    tone: "info" },
  expiring_30:        { label: "Expires ≤ 30d",    tone: "warn" },
  expired:            { label: "Expired",          tone: "danger" },
  out_of_stock:       { label: "Out of stock",     tone: "danger" },
  no_expiry_recorded: { label: "No expiry given",  tone: "muted" },
  never_checked:      { label: "Never checked",    tone: "muted" },
};

export type MedicineStatus = {
  medicine_id: string;
  sort_order: number;
  category: string;
  name: string;
  unit: string | null;
  qty: number | null;
  expiry_date: string | null;
  stock_state: string | null;
  last_checked_by: string | null;
  last_checked_at: string | null;
  last_period: string | null;
  remarks: string | null;
  expiry_status: ExpiryStatus;
  days_to_expiry: number | null;
};

export type BoxStatus = {
  box_id: string;
  box_no: number;
  location: string;
  first_aider_name: string | null;
  first_aider_mobile: string | null;
  last_checked_by: string | null;
  last_checked_at: string | null;
  last_status: string | null;
  days_since: number | null;
  total_checks: number;
};

export type Activity = {
  module: Module;
  record_id: string;
  person: string;
  at: string;
  on_date: string;
  ref_label: string;
  detail: string | null;
  remarks: string | null;
};

export type ShiftCompliance = {
  check_date: string;
  vehicle_id: string;
  vehicle_no: string;
  vehicle_label: string;
  shift: Shift;
  done: boolean;
  driver_name: string | null;
  staff_name: string | null;
  failed_count: number;
  remarks: string | null;
};

/**
 * First aid boxes have no fixed inspection cadence (confirmed with the plant),
 * so nothing is "overdue" by contract. These thresholds are advisory only —
 * they colour the freshness view so stale boxes surface.
 */
export const BOX_STALE_AMBER_DAYS = 30;
export const BOX_STALE_RED_DAYS = 90;

export function boxTone(days: number | null): "ok" | "warn" | "danger" | "muted" {
  if (days === null) return "muted";
  if (days >= BOX_STALE_RED_DAYS) return "danger";
  if (days >= BOX_STALE_AMBER_DAYS) return "warn";
  return "ok";
}
