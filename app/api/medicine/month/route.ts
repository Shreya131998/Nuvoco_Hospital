import { NextResponse } from "next/server";
import { backend } from "@/lib/data";
import { fail } from "@/lib/api";

/**
 * What has already been entered for a month, so the form can be resumed.
 * Returns stock figures only — never who recorded them — because this is
 * reachable from the public form.
 */
export async function GET(req: Request) {
  try {
    const month = new URL(req.url).searchParams.get("month") ?? "";
    if (!/^\d{4}-\d{2}-01$/.test(month))
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });

    return NextResponse.json({ rows: await backend().getMedicineMonth(month) });
  } catch (e) {
    return fail(e);
  }
}
