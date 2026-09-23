/**
 * Fills the three registers with realistic sample entries by POSTing to the
 * app's own submit endpoints — the same path a person on a phone takes.
 *
 * For demonstration only. Clear it afterwards with `npm run sheet:clear`.
 *
 *   node scripts/dev/seed-demo.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { JWT } from 'google-auth-library';

const BASE = process.argv[2] ?? 'http://localhost:3000';

for (const f of ['.env.local', '.env']) {
  try {
    readFileSync(f, 'utf8').split('\n').forEach((line) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) return;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  } catch {}
}

const ID = process.env.GOOGLE_SHEETS_ID;
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const { token } = await auth.getAccessToken();

const read = async (tab) => {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/${encodeURIComponent(`'${tab}'`)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then((x) => x.json());
  const [h, ...rows] = r.values ?? [[]];
  return rows.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]])));
};

const boxes = await read('_boxes');
const items = await read('_items');
const points = await read('_points');
const meds = await read('_medicines');
const vehicles = await read('_vehicles');

const IST = 'Asia/Kolkata';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());
const dayOffset = (n) => {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, fail = 0;
const track = (r, label) => {
  if (r.ok) { ok++; }
  else { fail++; console.log(`    FAILED ${label}: ${r.status} ${JSON.stringify(r.json)}`); }
};

// ── 1. First aid box checks ────────────────────────────────────────────
// The form stamps today's date, so these all land on today.
const firstAidRuns = [
  { loc: 'CANTEEN',              by: 'Amarjeet Kumar',    refill: { 15: 4, 16: 6 }, short: [],     remarks: '' },
  { loc: 'D. G HOUSE',           by: 'Sunil Chandel',     refill: { 1: 2, 17: 1 },  short: [],     remarks: '' },
  { loc: 'KILN MCC LINE - 2',    by: 'Domar Sahu',        refill: {},               short: [3],    remarks: 'Eye pads finished, indent raised' },
  { loc: 'MINES OFFICE',         by: 'Ansari Mohd Shoeb', refill: { 15: 6 },        short: [],     remarks: '' },
  { loc: 'PACKING PLANT',        by: 'Rajeshar',          refill: { 15: 2, 18: 3 }, short: [],     remarks: '' },
  { loc: 'CCR',                  by: 'Dani Ram Sahu',     refill: {},               short: [],     remarks: '' },
  { loc: 'MECHNICAL WORK SHOP',  by: 'Manakchand Verma',  refill: { 6: 1 },         short: [11],   remarks: 'Box lock broken, maintenance informed' },
  { loc: 'W.H R CONTROL ROOM',   by: 'Gajanand Mute',     refill: { 16: 5 },        short: [],     remarks: '' },
];

console.log('First Aid Kit');
for (const run of firstAidRuns) {
  const box = boxes.find((b) => b.location.trim() === run.loc);
  if (!box) { console.log(`    no box "${run.loc}"`); continue; }
  const payload = {
    box_id: box.id,
    checked_by_name: run.by,
    remarks: run.remarks || null,
    items: items.map((i) => {
      const sr = Number(i.sr_no);
      const std = Number(i.standard_qty);
      const isShort = run.short.includes(sr);
      return {
        item_id: i.id,
        qty_found: isShort ? 0 : Math.max(0, std - (run.refill[sr] ? 1 : 0)),
        qty_added: run.refill[sr] ?? 0,
      };
    }),
  };
  const r = await post('/api/submit/first-aid', payload);
  track(r, run.loc);
  console.log(`  ${r.ok ? 'ok' : '--'}  Box ${String(box.box_no).padStart(2)}  ${run.loc.padEnd(22)} ${run.by}`);
  await pause(1100);
}

// ── 2. Ambulance shift checks ──────────────────────────────────────────
const vehicle = vehicles[0];
const drivers = ['Ramesh Verma', 'Suresh Yadav', 'Mohan Lal'];
// Deliberate gaps so the compliance grid has something to show.
const skipped = new Set(['-8:C', '-6:B', '-5:C', '-3:B', '-1:C', '0:C']);
// sort_order -> how often that point fails
const failures = {
  '-9': [19], '-7': [19, 4], '-6': [19], '-4': [21], '-3': [19],
  '-2': [4], '-1': [19, 21], '0': [19],
};

console.log('\nAmbulance Check');
for (let d = -9; d <= 0; d++) {
  for (const [idx, shift] of ['A', 'B', 'C'].entries()) {
    if (skipped.has(`${d}:${shift}`)) continue;
    const failing = shift === 'A' ? (failures[String(d)] ?? []) : [];
    const r = await post('/api/submit/ambulance', {
      vehicle_id: vehicle.id,
      check_date: dayOffset(d),
      shift,
      driver_name: drivers[(Math.abs(d) + idx) % drivers.length],
      licence_no: ['CG04-2019-0012', 'CG04-2021-7788', 'CG04-2018-5521'][(Math.abs(d) + idx) % 3],
      licence_valid_until: '2028-03-31',
      checked_by_name: null,
      remarks: failing.length ? 'Reported to workshop' : null,
      results: points.map((p) => {
        const isFail = failing.includes(Number(p.sort_order));
        return {
          point_id: p.id,
          is_ok: !isFail,
          note: isFail
            ? { 19: 'Rear left tyre worn', 4: 'Door latch loose', 21: 'Torch battery dead' }[Number(p.sort_order)]
            : null,
        };
      }),
    });
    track(r, `${dayOffset(d)} ${shift}`);
    await pause(1100);
  }
  process.stdout.write(`  ${dayOffset(d)} done\n`);
}

// ── 3. Medicine monthly check ──────────────────────────────────────────
// Expiry dates chosen to land in every bucket the dashboard reports.
const expired = ['2026-08-20', '2026-09-05', '2026-09-14'];
const soon = ['2026-10-02', '2026-10-11', '2026-10-18'];
const ninety = ['2026-11-25', '2026-12-08', '2026-12-20'];
const valid = ['2027-03-31', '2027-06-30', '2027-09-30', '2028-01-31', '2028-06-30'];
const nilAt = new Set([3, 27, 55, 74]);

const recorded = meds.slice(0, 62).map((m, i) => {
  const order = Number(m.sort_order);
  if (nilAt.has(order)) {
    return { medicine_id: m.id, qty: null, expiry_date: null, stock_state: 'out_of_stock' };
  }
  let exp;
  if (i % 17 === 3) exp = expired[i % expired.length];
  else if (i % 13 === 5) exp = soon[i % soon.length];
  else if (i % 11 === 2) exp = ninety[i % ninety.length];
  else exp = valid[i % valid.length];
  return {
    medicine_id: m.id,
    qty: 5 + ((i * 7) % 90),
    expiry_date: exp,
    stock_state: 'in_stock',
  };
});

console.log('\nMedicine Check');
const monthStart = today.slice(0, 8) + '01';
const r = await post('/api/submit/medicine', {
  period_month: monthStart,
  checked_by_name: 'Dr. Mehta',
  remarks: 'Monthly count completed with pharmacist',
  rows: recorded,
});
track(r, 'medicine');
console.log(`  ${r.ok ? 'ok' : '--'}  ${monthStart}  ${recorded.length} medicines  Dr. Mehta`);

console.log(`\n${ok} submitted, ${fail} failed`);
