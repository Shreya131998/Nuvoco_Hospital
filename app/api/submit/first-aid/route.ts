import { NextResponse } from "next/server";
import { backend } from "@/lib/data";
import { arr, checkAccessCode, fail, int, optStr, personName, uuid } from "@/lib/api";

type ItemIn = { item_id: unknown; qty_found: unknown; qty_added: unknown };

export async function POST(req: Request) {
  try {
    checkAccessCode(req);
    const body = await req.json();

    const result = await backend().submitFirstAid({
      box_id: uuid(body.box_id, "Box"),
      checked_by_name: personName(body.checked_by_name, "Name"),
      remarks: optStr(body.remarks, "Remarks"),
      items: arr<ItemIn>(body.items, "Items", 100).map((i) => ({
        item_id: uuid(i.item_id, "Item"),
        qty_found: int(i.qty_found, "Quantity found"),
        qty_added: int(i.qty_added, "Quantity added"),
      })),
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return fail(e);
  }
}
