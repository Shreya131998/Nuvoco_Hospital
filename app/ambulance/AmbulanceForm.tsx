"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { FormShell, SubmitBar } from "@/components/forms/FormShell";
import { NameField } from "@/components/forms/NameField";
import { Badge, BiLabel, Button, Card, Field, inputClass } from "@/components/ui";
import { SHIFTS, SHIFT_TIME, type CheckPoint, type Shift, type Vehicle } from "@/lib/types";
import { istToday } from "@/lib/dates";

type Result = { is_ok: boolean; note: string };

export default function AmbulanceForm({
  vehicles,
  points,
}: {
  vehicles: Vehicle[];
  points: CheckPoint[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [date, setDate] = useState(istToday());
  const [shift, setShift] = useState<Shift | "">("");
  const [driver, setDriver] = useState("");
  const [staff, setStaff] = useState("");
  const [licence, setLicence] = useState("");
  const [licenceValid, setLicenceValid] = useState("");
  const [remarks, setRemarks] = useState("");
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(points.map((p) => [p.id, { is_ok: true, note: "" }]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const failed = points.filter((p) => !results[p.id]?.is_ok);
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  function setOk(id: string, is_ok: boolean) {
    setResults((s) => ({ ...s, [id]: { ...s[id], is_ok } }));
  }

  async function submit() {
    setErr(null);
    if (!vehicleId) return setErr("Please select a vehicle.");
    if (!shift) return setErr("Please select a shift. / कृपया शिफ्ट चुनें।");
    if (!driver.trim()) return setErr("Please enter the driver's name.");

    setBusy(true);
    try {
      const res = await fetch("/api/submit/ambulance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          check_date: date,
          shift,
          driver_name: driver.trim(),
          staff_name: staff.trim() || null,
          licence_no: licence.trim() || null,
          licence_valid_until: licenceValid || null,
          remarks: remarks.trim() || null,
          results: points.map((p) => ({
            point_id: p.id,
            is_ok: results[p.id].is_ok,
            note: results[p.id].note.trim() || null,
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
      <FormShell title="Ambulance / Vehicle Check" titleHi="वाहन चेक लिस्ट">
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-ok" size={44} />
          <h2 className="text-lg font-semibold">Saved</h2>
          <p className="hi mt-1 text-sm text-muted">जाँच रिकॉर्ड दर्ज हो गया।</p>
          <p className="mt-3 text-sm text-muted">
            {vehicle?.label} · {date} · Shift {shift}
            {failed.length > 0 && <> · {failed.length} issue(s) reported</>}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => router.push("/")}>Back to home</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Record another shift
            </Button>
          </div>
        </Card>
      </FormShell>
    );
  }

  return (
    <FormShell
      title="Ambulance / Vehicle Check"
      titleHi="वाहन चेक लिस्ट — प्रतिदिन, शिफ्ट अनुसार"
      subtitle="All points start as OK. Tap ✗ on anything that is not working."
    >
      <div className="grid gap-4">
        <Card title="1. Vehicle & shift" subtitle="वाहन एवं शिफ्ट">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label={<>Vehicle <span className="hi text-muted">/ गाड़ी</span></>} required>
              <select
                className={inputClass}
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.vehicle_no}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={<>Date <span className="hi text-muted">/ दिनांक</span></>} required>
              <input
                type="date"
                className={inputClass}
                value={date}
                max={istToday()}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium">
                Shift <span className="hi text-muted">/ शिफ्ट</span>{" "}
                <span className="text-danger">*</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                {SHIFTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShift(s)}
                    className={`rounded-lg border px-2 py-3 text-center transition ${
                      shift === s
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-strong hover:bg-surface-2"
                    }`}
                  >
                    <span className="block text-lg font-bold">{s}</span>
                    <span className="block text-[0.7rem] text-muted">{SHIFT_TIME[s]}</span>
                  </button>
                ))}
              </div>
            </div>

            {vehicle?.insurance_valid_until && (
              <p className="text-xs text-muted sm:col-span-2">
                Insurance / बीमा वैधता: {vehicle.insurance_valid_until}
              </p>
            )}
          </div>
        </Card>

        <Card title="2. Driver" subtitle="चालक">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <NameField
                value={driver}
                onChange={setDriver}
                label="Driver name"
                labelHi="चालक का नाम"
              />
            </div>
            <div className="sm:col-span-2">
              <NameField
                value={staff}
                onChange={setStaff}
                label="Staff name"
                labelHi="स्टाफ का नाम"
                placeholder="OHC staff on duty / ड्यूटी पर स्टाफ"
                optional
              />
            </div>
            <Field label={<>Licence no. <span className="hi text-muted">/ लाइसेंस नम्बर</span></>}>
              <input
                className={inputClass}
                value={licence}
                onChange={(e) => setLicence(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label={<>Licence valid till <span className="hi text-muted">/ वैधता</span></>}>
              <input
                type="date"
                className={inputClass}
                value={licenceValid}
                onChange={(e) => setLicenceValid(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card
          title="3. Check points"
          subtitle={`${points.length} points · जाँच बिंदु`}
          action={
            failed.length > 0 ? (
              <Badge tone="danger">{failed.length} not OK</Badge>
            ) : (
              <Badge tone="ok">All OK</Badge>
            )
          }
        >
          <ul className="divide-y divide-border">
            {points.map((p, idx) => {
              const r = results[p.id];
              return (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-xs font-semibold text-muted">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <BiLabel hi={p.label_hi} en={p.label_en} />
                    </div>
                    <div
                      role="group"
                      aria-label={`${p.label_en} status`}
                      className="flex shrink-0 overflow-hidden rounded-lg border border-border-strong"
                    >
                      <button
                        type="button"
                        aria-pressed={r.is_ok}
                        onClick={() => setOk(p.id, true)}
                        className={`px-4 py-2 text-sm font-bold transition ${
                          r.is_ok ? "bg-ok text-white" : "bg-surface text-muted"
                        }`}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        aria-pressed={!r.is_ok}
                        onClick={() => setOk(p.id, false)}
                        className={`border-l border-border-strong px-4 py-2 text-sm font-bold transition ${
                          !r.is_ok ? "bg-danger text-white" : "bg-surface text-muted"
                        }`}
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                  {!r.is_ok && (
                    <input
                      className={`${inputClass} mt-2`}
                      placeholder="What is the problem? / क्या समस्या है?"
                      value={r.note}
                      onChange={(e) =>
                        setResults((s) => ({
                          ...s,
                          [p.id]: { ...s[p.id], note: e.target.value },
                        }))
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="4. Remarks" subtitle="टिप्पणी (वैकल्पिक)">
          <div className="p-4">
            <Field label="Anything else to report?">
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

        {failed.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
            <span>
              {failed.length} point(s) marked not OK: {failed.map((f) => f.label_en).join(", ")}.
              These are sent to the OHC admin immediately.
            </span>
          </div>
        )}
        {err && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{err}</p>}
      </div>

      <SubmitBar>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {shift ? `Shift ${shift} · ${date}` : "Select a shift"}
        </span>
        <Button onClick={submit} disabled={busy} className="shrink-0 whitespace-nowrap">
          {busy ? "Saving…" : "Submit / जमा करें"}
        </Button>
      </SubmitBar>
    </FormShell>
  );
}
