import { NextResponse } from "next/server";
import { backend } from "@/lib/data";
import {
  BadRequest, arr, checkAccessCode, date, fail, optDate, optInt, optStr, personName, uuid,
} from "@/lib/api";

type RowIn = { medicine_id: unknown; qty: unknown; expiry_date: unknown; stock_state: unknown };

export async function POST(req: Request) {
  try {
    checkAccessCode(req);
    const body = await req.json();

    const period_month = date(body.period_month, "Month");
    if (!period_month.endsWith("-01"))
      return NextResponse.json({ error: "Month must be the 1st" }, { status: 400 });

    const rows = arr<RowIn>(body.rows, "Rows", 150).map((r) => {
      const state = r.stock_state as "in_stock" | "out_of_stock";
      if (state !== "in_stock" && state !== "out_of_stock")
        throw new BadRequest("Stock state must be in_stock or out_of_stock");
      return {
        medicine_id: uuid(r.medicine_id, "Medicine"),
        qty: optInt(r.qty, "Quantity", 0, 99999),
        expiry_date: optDate(r.expiry_date, "Expiry date"),
        stock_state: state,
      };
    });

    if (!rows.length) return NextResponse.json({ ok: true, saved: 0 });

    const { saved } = await backend().saveMedicine({
      period_month,
      checked_by_name: personName(body.checked_by_name, "Name"),
      remarks: optStr(body.remarks, "Remarks"),
      rows,
    });

    return NextResponse.json({ ok: true, saved });
  } catch (e) {
    return fail(e);
  }
}
