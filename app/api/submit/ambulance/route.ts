import { NextResponse } from "next/server";
import { backend } from "@/lib/data";
import {
  arr, bool, checkAccessCode, date, fail, optDate, optStr, personName, uuid,
} from "@/lib/api";

type ResultIn = { point_id: unknown; is_ok: unknown; note: unknown };

export async function POST(req: Request) {
  try {
    checkAccessCode(req);
    const body = await req.json();

    const shift = body.shift;
    if (shift !== "A" && shift !== "B" && shift !== "C")
      return NextResponse.json({ error: "Shift must be A, B or C" }, { status: 400 });

    const check_date = date(body.check_date, "Date");

    const result = await backend().submitAmbulance({
      vehicle_id: uuid(body.vehicle_id, "Vehicle"),
      check_date,
      shift,
      driver_name: personName(body.driver_name, "Driver name"),
      licence_no: optStr(body.licence_no, "Licence number", 60),
      licence_valid_until: optDate(body.licence_valid_until, "Licence validity"),
      checked_by_name: optStr(body.checked_by_name, "Checked by", 120),
      remarks: optStr(body.remarks, "Remarks"),
      results: arr<ResultIn>(body.results, "Check points", 60).map((r) => ({
        point_id: uuid(r.point_id, "Check point"),
        is_ok: bool(r.is_ok, "Check point status"),
        note: optStr(r.note, "Note", 500),
      })),
    });

    if ("duplicate" in result) {
      return NextResponse.json(
        {
          error: `Shift ${shift} for this vehicle on ${check_date} has already been submitted. / यह शिफ्ट पहले ही दर्ज हो चुकी है।`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return fail(e);
  }
}
