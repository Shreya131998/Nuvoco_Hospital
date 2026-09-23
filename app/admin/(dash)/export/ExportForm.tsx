"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { addDays, istToday } from "@/lib/dates";

const MODULES = [
  { key: "first_aid", label: "First Aid Boxes", sheets: "2 sheets: checks + item lines" },
  { key: "ambulance", label: "Ambulance / Vehicle", sheets: "1 sheet, laid out like the paper form" },
  { key: "medicine", label: "OHC Medicines", sheets: "1 sheet, expired dates highlighted" },
];

export default function ExportForm() {
  const today = istToday();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [picked, setPicked] = useState<string[]>(MODULES.map((m) => m.key));

  const invalid = from > to || picked.length === 0;
  const href = `/api/export?from=${from}&to=${to}&modules=${picked.join(",")}`;

  return (
    <Card title="Choose what to export" subtitle="Downloads a single .xlsx workbook">
      <div className="grid gap-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From">
            <input type="date" className={inputClass} value={from} max={to}
              onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputClass} value={to} min={from} max={today}
              onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Modules</legend>
          <div className="grid gap-2">
            {MODULES.map((m) => (
              <label
                key={m.key}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                  checked={picked.includes(m.key)}
                  onChange={(e) =>
                    setPicked((s) =>
                      e.target.checked ? [...s, m.key] : s.filter((x) => x !== m.key)
                    )
                  }
                />
                <span>
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted">{m.sheets}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          {/* A real anchor, not a router push — this is a file download, and
              client-side navigation would swallow it. */}
          <a
            href={invalid ? undefined : href}
            download
            aria-disabled={invalid}
            className={
              "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 " +
              "text-sm font-semibold text-primary-fg transition hover:opacity-90 " +
              (invalid ? "pointer-events-none opacity-50" : "")
            }
          >
            <Download size={16} />
            Download Excel
          </a>
          {invalid && (
            <span className="text-xs text-danger">
              {picked.length === 0 ? "Select at least one module." : "“From” must be before “To”."}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
