/**
 * Tab layout for the Google Sheets backend.
 *
 * THREE visible tabs, one per register, mirroring the three original
 * workbooks. Each is an append-only running log: one row per entry.
 *
 * The master lists the forms need are kept in hidden tabs prefixed with "_",
 * so the spreadsheet reads as three registers and nothing else. Unhide them
 * to add a medicine, move a box, or change the vehicle.
 *
 * There is no staff list: names are typed by the person filling the form.
 */

export const TAB = {
  firstAid: "First Aid Kit",
  ambulance: "Ambulance Check",
  medicine: "Medicine Check",
  // hidden
  box: "_boxes",
  item: "_items",
  point: "_points",
  medicineMaster: "_medicines",
  vehicle: "_vehicles",
} as const;

export const VISIBLE_TABS = [TAB.firstAid, TAB.ambulance, TAB.medicine];
export const HIDDEN_TABS = [TAB.box, TAB.item, TAB.point, TAB.medicineMaster, TAB.vehicle];

/** Tabs from the previous nine-tab layout, removed on the next init. */
export const LEGACY_TABS = [
  "staff", "first_aid_box", "first_aid_item", "vehicle",
  "vehicle_check_point", "medicine",
  "first_aid_check", "vehicle_check", "medicine_check",
];

export const HEADERS: Record<string, string[]> = {
  [TAB.box]: ["box_no", "location", "first_aider", "first_aider_mobile", "active", "id"],
  [TAB.item]: ["sr_no", "name_en", "name_hi", "spec", "standard_qty", "id"],
  [TAB.point]: ["sort_order", "label_hi", "label_en", "active", "id"],
  [TAB.medicineMaster]: ["sort_order", "category", "name", "unit", "active", "id"],
  [TAB.vehicle]: ["vehicle_no", "label", "insurance_valid_until", "active", "id"],
};

/** Fixed columns preceding the per-item / per-point columns. */
export const FIRST_AID_META = [
  "check_date", "time", "box_no", "location", "checked_by",
  "status", "total_found", "total_added", "remarks", "checked_at", "id",
];

export const MEDICINE_META = [
  "period_month", "month", "checked_by", "recorded", "remarks", "checked_at", "id",
];

export const VEHICLE_META = [
  "check_date", "shift", "vehicle_no", "vehicle", "driver_name",
  "licence_no", "licence_valid_until", "checked_by", "remarks",
  "submitted_at", "id",
];

/** Per-item column pair, prefixed with the S.No so the column can be matched
 *  back to its item even if the item is later renamed. */
export const itemFoundHeader = (srNo: number, name: string, spec?: string | null) =>
  `${srNo}. ${name}${spec ? ` (${spec})` : ""} — found`;
export const itemAddedHeader = (srNo: number, name: string, spec?: string | null) =>
  `${srNo}. ${name}${spec ? ` (${spec})` : ""} — added`;

/**
 * Per-medicine column pair. The quantity cell doubles as the stock state:
 * a number when counted, the literal NIL when out of stock, blank when the
 * medicine was not checked that month. A third column per medicine would put
 * the register past 300 columns for no real gain.
 */
export const medicineQtyHeader = (order: number, name: string) => `${order}. ${name} — qty`;
export const medicineExpiryHeader = (order: number, name: string) => `${order}. ${name} — expiry`;
export const NIL_MARK = "NIL";

/** Per-check-point column, bilingual like the paper sheet. */
export const pointHeader = (order: number, hi: string, en: string) =>
  `${order}. ${hi} / ${en}`;

/** Leading "<n>." token — how a wide column is matched back to its item/point. */
export function leadingIndex(header: string): number | null {
  const m = /^(\d+)\./.exec(header.trim());
  return m ? Number(m[1]) : null;
}

export const OK_MARK = "✓";
export const FAIL_MARK = "✗";
