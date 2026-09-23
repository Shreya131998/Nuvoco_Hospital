"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { FormShell, SubmitBar } from "@/components/forms/FormShell";
import { NameField } from "@/components/forms/NameField";
import { Badge, Button, Card, Field, inputClass } from "@/components/ui";
import type { Medicine } from "@/lib/types";
import { istMonthStart, istToday, MONTHS } from "@/lib/dates";

type Row = { qty: string; expiry: string; out: boolean };

const blank = (): Row => ({ qty: "", expiry: "", out: false });
const isFilled = (r?: Row) => !!r && (r.qty !== "" || r.expiry !== "" || r.out);

export default function MedicineForm({ medicines }: { medicines: Medicine[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(istMonthStart());
  const [who, setWho] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [remarks, setRemarks] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const loading = loadedMonth !== month;

  const categories = useMemo(() => {
    const m = new Map<string, Medicine[]>();
    medicines.forEach((x) => {
      if (!m.has(x.category)) m.set(x.category, []);
      m.get(x.category)!.push(x);
    });
    return [...m.entries()];
  }, [medicines]);

  // Load whatever was submitted for this month, so re-submitting is a
  // correction rather than starting from scratch.
  useEffect(() => {
    let cancelled = false;
    const fresh: Record<string, Row> = {};
    medicines.forEach((m) => (fresh[m.id] = blank()));

    fetch(`/api/medicine/month?month=${month}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        (json.rows ?? []).forEach(
          (r: {
            medicine_id: string;
            qty: number | null;
            expiry_date: string | null;
            stock_state: string;
          }) => {
            fresh[r.medicine_id] = {
              qty: r.stock_state === "out_of_stock" ? "" : r.qty === null ? "" : String(r.qty),
              expiry: r.expiry_date ?? "",
              out: r.stock_state === "out_of_stock",
            };
          }
        );
        setRows(fresh);
        setLoadedMonth(month);
      })
      .catch(() => {
        if (cancelled) return;
        setRows(fresh);
        setLoadedMonth(month);
      });

    return () => {
      cancelled = true;
    };
  }, [month, medicines]);

  function edit(id: string, patch: Partial<Row>) {
    setRows((s) => ({ ...s, [id]: { ...(s[id] ?? blank()), ...patch } }));
  }

  const filled = medicines.filter((m) => isFilled(rows[m.id]));
  const nameMissing = !who.trim();
  const monthLabel = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

  const monthOptions = useMemo(() => {
    const out: string[] = [];
    const today = istToday();
    let y = Number(today.slice(0, 4));
    let m = Number(today.slice(5, 7));
    for (let i = 0; i < 12; i++) {
      out.push(`${y}-${String(m).padStart(2, "0")}-01`);
      m -= 1;
      if (m === 0) { m = 12; y -= 1; }
    }
    return out;
  }, []);

  async function submit() {
    setErr(null);
    if (nameMissing) return setErr("Please enter your name.");
    if (filled.length === 0)
      return setErr("Nothing to submit — record at least one medicine.");

    setBusy(true);
    try {
      const res = await fetch("/api/submit/medicine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_month: month,
          checked_by_name: who.trim(),
          remarks: remarks.trim() || null,
          rows: filled.map((m) => {
            const r = rows[m.id];
            return {
              medicine_id: m.id,
              qty: r.out ? null : r.qty === "" ? null : Number(r.qty),
              expiry_date: r.out ? null : r.expiry || null,
              stock_state: r.out ? "out_of_stock" : "in_stock",
            };
          }),
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
      <FormShell title="OHC Medicine Check" titleHi="दवा जाँच सूची">
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-ok" size={44} />
          <h2 className="text-lg font-semibold">Submitted</h2>
          <p className="hi mt-1 text-sm text-muted">दवा जाँच दर्ज हो गई।</p>
          <p className="mt-3 text-sm text-muted">
            {monthLabel} · {filled.length} of {medicines.length} medicines recorded
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => router.push("/")}>Back to home</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Edit this month
            </Button>
          </div>
        </Card>
      </FormShell>
    );
  }

  return (
    <FormShell
      title="OHC Medicine Check"
      titleHi="दवा जाँच सूची — मासिक"
      subtitle="Fill in what you counted, then press Submit once at the end."
    >
      <div className="grid gap-4">
        <Card title="1. Month & who is checking" subtitle="माह एवं जाँचकर्ता">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label={<>Month <span className="hi text-muted">/ माह</span></>} required>
              <select
                className={inputClass}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {MONTHS[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}
                  </option>
                ))}
              </select>
            </Field>
            <NameField
              value={who}
              onChange={setWho}
              label="Checked by"
              labelHi="जाँचकर्ता"
            />
          </div>
        </Card>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium">{monthLabel}</span>
          <Badge tone={filled.length === medicines.length ? "ok" : filled.length > 0 ? "info" : "muted"}>
            {filled.length} / {medicines.length} filled
          </Badge>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted">
            <Loader2 className="mx-auto mb-2 animate-spin" size={20} />
            Loading this month’s entries…
          </Card>
        ) : (
          categories.map(([cat, list]) => {
            const done = list.filter((m) => isFilled(rows[m.id])).length;
            const isOpen = open === cat;
            return (
              <Card key={cat} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : cat)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold">{cat}</span>
                  <Badge tone={done === list.length ? "ok" : done > 0 ? "info" : "muted"}>
                    {done}/{list.length}
                  </Badge>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <ul className="divide-y divide-border border-t border-border">
                    {list.map((m) => {
                      const r = rows[m.id] ?? blank();
                      return (
                        <li key={m.id} className="px-4 py-3">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="w-6 shrink-0 text-xs font-semibold text-muted">
                              {m.sort_order}
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-medium">{m.name}</span>
                          </div>
                          <div className="grid grid-cols-[1fr_1.3fr_auto] items-end gap-2">
                            <label className="block">
                              <span className="mb-1 block text-[0.7rem] font-medium text-muted">
                                Qty / मात्रा
                              </span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                disabled={r.out}
                                className={inputClass}
                                value={r.qty}
                                onChange={(e) => edit(m.id, { qty: e.target.value })}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[0.7rem] font-medium text-muted">
                                Expiry / एक्सपायरी
                              </span>
                              <input
                                type="date"
                                disabled={r.out}
                                className={inputClass}
                                value={r.expiry}
                                onChange={(e) => edit(m.id, { expiry: e.target.value })}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => edit(m.id, { out: !r.out, qty: "", expiry: "" })}
                              className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                                r.out
                                  ? "border-danger bg-danger-soft text-danger"
                                  : "border-border-strong text-muted hover:bg-surface-2"
                              }`}
                            >
                              Nil
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })
        )}

        <Card title="Remarks" subtitle="टिप्पणी (वैकल्पिक)">
          <div className="p-4">
            <Field label="Anything to report?">
              <textarea
                rows={3}
                className={inputClass}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
        </Card>

        {err && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{err}</p>}
        {nameMissing && filled.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-warn-soft p-3 text-sm text-warn">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Enter your name before submitting.
          </p>
        )}
      </div>

      <SubmitBar>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {monthLabel} · {filled.length} filled
        </span>
        <Button onClick={submit} disabled={busy} className="shrink-0 whitespace-nowrap">
          {busy ? "Submitting…" : "Submit / जमा करें"}
        </Button>
      </SubmitBar>
    </FormShell>
  );
}
