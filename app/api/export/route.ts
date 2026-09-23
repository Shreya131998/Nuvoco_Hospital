import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { backend } from "@/lib/data";
import { isAdmin } from "@/lib/auth";

/**
 * Excel export. The plant has audited from these sheets for years, so the
 * layouts mirror the paper registers rather than the storage format.
 *
 * Auth is checked explicitly: route handlers are not covered by the admin
 * layout, so without this the export would be public.
 */
export async function GET(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const modules = (url.searchParams.get("modules") ?? "first_aid,ambulance,medicine").split(",");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const data = await backend().getExportData({ from, to }, modules);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nuvoco Sonadih OHC";
  wb.created = new Date();

  const header = (ws: ExcelJS.Worksheet, cols: string[], widths: number[]) => {
    ws.columns = cols.map((c, i) => ({ header: c, key: `c${i}`, width: widths[i] ?? 16 }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: "middle", wrapText: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const PINK = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFBDEDF" } };

  if (modules.includes("first_aid")) {
    const ws = wb.addWorksheet("First Aid Checks");
    header(ws,
      ["Date", "Time", "Box No.", "Location", "Checked By", "Status", "Remarks"],
      [12, 10, 9, 28, 22, 12, 40]);
    data.firstAid.forEach((c) =>
      ws.addRow([c.check_date, c.time, c.box_no, c.location, c.checked_by, c.status, c.remarks])
    );

    const ws2 = wb.addWorksheet("First Aid Items");
    header(ws2,
      ["Date", "Box No.", "Location", "S.No", "Item", "Item Details", "Std Qty", "Found", "Refilled"],
      [12, 9, 26, 7, 34, 16, 9, 9, 10]);
    data.firstAidItems.forEach((l) =>
      ws2.addRow([
        l.check_date, l.box_no, l.location, l.sr_no, l.name_en,
        l.spec ?? "", l.standard_qty, l.qty_found, l.qty_added,
      ])
    );
  }

  if (modules.includes("ambulance")) {
    const ws = wb.addWorksheet("Ambulance Check List");
    // Hindi above English, as on the paper form.
    const cols = ["दिनांक / Date", "शिफ्ट / Shift", "गाड़ी / Vehicle", "चालक / Driver", "लाइसेंस"];
    data.pointColumns.forEach((p) => cols.push(`${p.label_hi}\n${p.label_en}`));
    cols.push("टिप्पणी / Remarks");
    header(ws, cols, [12, 8, 22, 22, 16, ...data.pointColumns.map(() => 11), 40]);
    ws.getRow(1).height = 38;

    data.ambulance.forEach((c) => {
      const row = ws.addRow([
        c.check_date, c.shift, c.vehicle, c.driver_name, c.licence_no,
        ...c.marks, c.remarks,
      ]);
      // Colour the failures so a reviewer finds them without reading every cell.
      c.failedIndexes.forEach((i) => { row.getCell(6 + i).fill = PINK; });
    });
  }

  if (modules.includes("medicine")) {
    const ws = wb.addWorksheet("OHC Medicine Check");
    header(ws,
      ["Month", "Category", "Name of Item", "Qty", "Exp. Date", "Stock", "Checked By", "Checked On", "Remarks"],
      [11, 24, 34, 8, 13, 13, 22, 18, 30]);
    data.medicine.forEach((r) => {
      const row = ws.addRow([
        r.period_month, r.category, r.name, r.qty ?? "", r.expiry_date ?? "",
        r.stock_state === "out_of_stock" ? "NIL" : "In stock",
        r.checked_by, r.checked_on, r.remarks,
      ]);
      if (r.expired) {
        row.getCell(5).fill = PINK;
        row.getCell(5).font = { bold: true };
      }
    });
  }

  if (wb.worksheets.length === 0) wb.addWorksheet("Empty");

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nuvoco-ohc-${from}-to-${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
