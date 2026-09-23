"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, TriangleAlert } from "lucide-react";
import { FormShell, SubmitBar } from "@/components/forms/FormShell";
import { NameField } from "@/components/forms/NameField";
import { QtyStepper } from "@/components/forms/QtyStepper";
import { Badge, BiLabel, Button, Card, Field, inputClass } from "@/components/ui";
import type { BoxPublic, FirstAidItem } from "@/lib/types";

type Line = { qty_found: number; qty_added: number };

export default function FirstAidForm({
  boxes,
  items,
}: {
  boxes: BoxPublic[];
  items: FirstAidItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [boxId, setBoxId] = useState("");
  const [who, setWho] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(
      items.map((i) => [i.id, { qty_found: i.standard_qty, qty_added: 0 }])
    )
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boxes;
    return boxes.filter(
      (b) =>
        b.location.toLowerCase().includes(q) ||
        String(b.box_no).includes(q) ||
        (b.first_aider_name ?? "").toLowerCase().includes(q)
    );
  }, [boxes, query]);

  const box = boxes.find((b) => b.id === boxId);

  // A box is "short" when anything is below its standard quantity and the
  // person has not topped it back up — that is what the admin needs to see.
  const shortages = items.filter((i) => {
    const l = lines[i.id];
    return l && l.qty_found + l.qty_added < i.standard_qty;
  });
  const totalAdded = Object.values(lines).reduce((s, l) => s + l.qty_added, 0);

  async function submit() {
    setErr(null);
    if (!boxId) return setErr("Please select a first aid box.");
    if (!who.trim()) return setErr("Please enter your name.");

    setBusy(true);
    try {
      const res = await fetch("/api/submit/first-aid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          box_id: boxId,
          checked_by_name: who.trim(),
          remarks: remarks.trim() || null,
          items: items.map((i) => ({
            item_id: i.id,
            qty_found: lines[i.id].qty_found,
            qty_added: lines[i.id].qty_added,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submission failed");
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <FormShell title="First Aid Box" titleHi="फर्स्ट ऐड बॉक्स">
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-ok" size={44} />
          <h2 className="text-lg font-semibold">Saved</h2>
          <p className="hi mt-1 text-sm text-muted">रिकॉर्ड सफलतापूर्वक दर्ज हो गया।</p>
          <p className="mt-3 text-sm text-muted">
            Box {box?.box_no} — {box?.location}
            {totalAdded > 0 && <> · {totalAdded} item(s) refilled</>}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => router.push("/")}>Back to home</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Record another box
            </Button>
          </div>
        </Card>
      </FormShell>
    );
  }

  return (
    <FormShell
      title="First Aid Box"
      titleHi="फर्स्ट ऐड बॉक्स — जाँच एवं रीफिलिंग"
      subtitle="Select your box, then record what you found and what you refilled."
    >
      <div className="grid gap-4">
        <Card title="1. Which box?" subtitle="कौन सा बॉक्स?">
          <div className="p-4">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Search by location, box no. or first aider"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="mt-3 max-h-72 min-w-0 space-y-2 overflow-y-auto pr-1">
              {filtered.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBoxId(b.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                    boxId === b.id
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:bg-surface-2"
                  }`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-bold">
                    {b.box_no}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {b.location}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {b.first_aider_name ?? "No first aider assigned"}
                    </span>
                  </span>
                  {boxId === b.id && <CheckCircle2 size={18} className="text-primary" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">No box matches.</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="2. Who is filling this?" subtitle="यह कौन भर रहा है?">
          <div className="p-4">
            <NameField value={who} onChange={setWho} />
          </div>
        </Card>

        <Card
          title="3. Box contents"
          subtitle="बॉक्स की सामग्री — मिला हुआ / भरा गया"
          action={
            totalAdded > 0 ? (
              <Badge tone="primary">{totalAdded} refilled</Badge>
            ) : undefined
          }
        >
          {/* Column headers only exist where the columns do. On a phone the
              two steppers move below the name and carry their own labels. */}
          <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-border px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted sm:grid">
            <span>Item</span>
            <span className="w-[7.5rem] text-center">Found</span>
            <span className="w-[7.5rem] text-center">Added</span>
          </div>
          <ul className="divide-y divide-border">
            {items.map((i) => {
              const l = lines[i.id];
              const short = l.qty_found + l.qty_added < i.standard_qty;
              return (
                <li
                  key={i.id}
                  className="px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-x-3"
                >
                  <div className="min-w-0">
                    <BiLabel hi={i.name_hi} en={i.name_en} />
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {i.spec && <span>{i.spec}</span>}
                      <span>· std {i.standard_qty}</span>
                      {short && <Badge tone="warn">short</Badge>}
                    </span>
                  </div>

                  {/* Labels sit ABOVE the steppers on a phone. Side by side,
                      two labelled groups overflow 375px and scroll the page. */}
                  <div className="mt-2 flex items-end gap-3 sm:hidden">
                    <span className="block min-w-0 flex-1">
                      <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                        Found
                      </span>
                      <QtyStepper
                        ariaLabel={`${i.name_en} quantity found`}
                        value={l.qty_found}
                        onChange={(n) =>
                          setLines((s) => ({ ...s, [i.id]: { ...s[i.id], qty_found: n } }))
                        }
                      />
                    </span>
                    <span className="block min-w-0 flex-1">
                      <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                        Added
                      </span>
                      <QtyStepper
                        ariaLabel={`${i.name_en} quantity added`}
                        tone="add"
                        value={l.qty_added}
                        onChange={(n) =>
                          setLines((s) => ({ ...s, [i.id]: { ...s[i.id], qty_added: n } }))
                        }
                      />
                    </span>
                  </div>

                  <div className="hidden w-[7.5rem] sm:block">
                    <QtyStepper
                      ariaLabel={`${i.name_en} quantity found`}
                      value={l.qty_found}
                      onChange={(n) =>
                        setLines((s) => ({ ...s, [i.id]: { ...s[i.id], qty_found: n } }))
                      }
                    />
                  </div>
                  <div className="hidden w-[7.5rem] sm:block">
                    <QtyStepper
                      ariaLabel={`${i.name_en} quantity added`}
                      tone="add"
                      value={l.qty_added}
                      onChange={(n) =>
                        setLines((s) => ({ ...s, [i.id]: { ...s[i.id], qty_added: n } }))
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="4. Remarks" subtitle="टिप्पणी (वैकल्पिक)">
          <div className="p-4">
            <Field label="Anything to report?">
              <textarea
                rows={3}
                className={inputClass}
                placeholder="e.g. box lock broken, items expired"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        {shortages.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-warn-soft p-3 text-sm text-warn">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            <span>
              {shortages.length} item(s) will still be below the standard quantity
              after this refill. This will be flagged to the admin.
            </span>
          </div>
        )}
        {err && (
          <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{err}</p>
        )}
      </div>

      <SubmitBar>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {box ? `Box ${box.box_no} — ${box.location}` : "No box selected"}
        </span>
        <Button onClick={submit} disabled={busy} className="shrink-0 whitespace-nowrap">
          {busy ? "Saving…" : "Submit / जमा करें"}
        </Button>
      </SubmitBar>
    </FormShell>
  );
}
