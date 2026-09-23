/**
 * Creates every tab in the Google Sheet and fills the reference tabs from
 * data/source/*.xlsx.
 *
 * Safe to re-run: reference tabs are rewritten, submission tabs are only
 * created if missing and are never cleared.
 *
 *   npm run sheet:init
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JWT } from 'google-auth-library';
import { parseWorkbooks } from './parse-workbooks.mjs';

// .env.local is not loaded automatically outside Next.
for (const file of ['.env.local', '.env']) {
  try {
    readFileSync(file, 'utf8').split('\n').forEach((line) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) return;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  } catch { /* file may not exist */ }
}

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const KEY = process.env.GOOGLE_PRIVATE_KEY;

// Same loopback seam as the app: lets the sheet be built against the local
// stand-in (scripts/dev/fake-sheets.mjs) without Google credentials.
const OVERRIDE = process.env.GOOGLE_SHEETS_API_BASE;
const LOCAL = Boolean(OVERRIDE && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(OVERRIDE));

if (!SHEET_ID || (!LOCAL && (!EMAIL || !KEY))) {
  console.error(
    '\nMissing configuration. Set these in .env.local:\n' +
    '  GOOGLE_SHEETS_ID\n  GOOGLE_SERVICE_ACCOUNT_EMAIL\n  GOOGLE_PRIVATE_KEY\n' +
    '\nSee the README section "Google Sheets setup".\n'
  );
  process.exit(1);
}

const auth = LOCAL
  ? null
  : new JWT({
      email: EMAIL,
      key: KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
const API = `${LOCAL ? OVERRIDE : 'https://sheets.googleapis.com/v4/spreadsheets'}/${SHEET_ID}`;

async function call(path, init) {
  const token = LOCAL ? 'local-stub' : (await auth.getAccessToken()).token;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      // Both causes return 403; the body distinguishes them.
      if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(body)) {
        const proj = /project[s]?[ /]([0-9]+)/i.exec(body)?.[1] ?? '';
        throw new Error(
          'The Google Sheets API is not enabled for this service account\'s project.\n' +
          'Enable it here, wait ~1 minute, then re-run:\n  ' +
          `https://console.cloud.google.com/apis/library/sheets.googleapis.com${proj ? `?project=${proj}` : ''}`
        );
      }
      throw new Error(
        'Access denied (403). Open the spreadsheet, click Share, and add\n  ' +
        `${EMAIL}\nas an Editor. Then re-run.`
      );
    }
    if (res.status === 404) {
      throw new Error(`Spreadsheet not found (404). Check GOOGLE_SHEETS_ID.\n${body.slice(0, 200)}`);
    }
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

const { staff, boxes, items, points, medicines, ITEM_HI } = await parseWorkbooks();

// Stable ids, generated once here and stored in the sheet's last column.
const itemIds = items.map(() => randomUUID());
const pointIds = points.map(() => randomUUID());
const medIds = medicines.map(() => randomUUID());
const vehicleId = randomUUID();

// Hidden master tabs. Names are NOT stored — people type their own.
const REFERENCE = {
  _boxes: {
    header: ['box_no', 'location', 'first_aider', 'first_aider_mobile', 'active', 'id'],
    rows: boxes.map((b) => {
      const person = staff.find((s) => s.name === b.aider);
      return [b.boxNo, b.loc, b.aider ?? '', person?.mobile ?? '', 'TRUE', randomUUID()];
    }),
  },
  _items: {
    header: ['sr_no', 'name_en', 'name_hi', 'spec', 'standard_qty', 'id'],
    rows: items.map((i, n) => [i.sr, i.name, ITEM_HI[i.name] ?? '', i.spec ?? '', i.qty, itemIds[n]]),
  },
  _points: {
    header: ['sort_order', 'label_hi', 'label_en', 'active', 'id'],
    rows: points.map((p, n) => [p.order, p.hi, p.en, 'TRUE', pointIds[n]]),
  },
  _medicines: {
    header: ['sort_order', 'category', 'name', 'unit', 'active', 'id'],
    rows: medicines.map((m, n) => [m.order, m.category, m.name, '', 'TRUE', medIds[n]]),
  },
  _vehicles: {
    header: ['vehicle_no', 'label', 'insurance_valid_until', 'active', 'id'],
    // The source sheet leaves the registration blank — a placeholder to rename.
    rows: [['CG-00-0000', 'Ambulance', '', 'TRUE', vehicleId]],
  },
};

const FIRST_AID_META = [
  'check_date', 'time', 'box_no', 'location', 'checked_by',
  'status', 'total_found', 'total_added', 'remarks', 'checked_at', 'id',
];
const MEDICINE_META = [
  'period_month', 'month', 'checked_by', 'recorded', 'remarks', 'checked_at', 'id',
];
const VEHICLE_META = [
  'check_date', 'shift', 'vehicle_no', 'vehicle', 'driver_name',
  'staff_name', 'licence_no', 'licence_valid_until', 'remarks', 'submitted_at', 'id',
];

const TRANSACTION = {
  'First Aid Kit': [
    ...FIRST_AID_META,
    ...items.flatMap((i) => {
      const label = `${i.sr}. ${i.name}${i.spec ? ` (${i.spec})` : ''}`;
      return [`${label} — found`, `${label} — added`];
    }),
  ],
  'Ambulance Check': [
    ...VEHICLE_META,
    ...points.map((p) => `${p.order}. ${p.hi} / ${p.en}`),
    'issues',
  ],
  // Wide, like the other two registers: one row per monthly submission with
  // every medicine in sequence across the columns.
  'Medicine Check': [
    ...MEDICINE_META,
    ...medicines.flatMap((m) => [`${m.order}. ${m.name} — qty`, `${m.order}. ${m.name} — expiry`]),
  ],
};

// ---- tabs: create, hide masters, drop the old layout ------------------
// Tabs from the previous nine-tab layout.
// Reference ones are regenerated from the workbooks, so deleting them loses
// nothing. Submission ones may hold real entries, so they are guarded.
const LEGACY_REFERENCE = [
  'staff', 'first_aid_box', 'first_aid_item', 'vehicle',
  'vehicle_check_point', 'medicine',
];
const LEGACY_SUBMISSIONS = ['first_aid_check', 'vehicle_check', 'medicine_check'];
const LEGACY = [...LEGACY_REFERENCE, ...LEGACY_SUBMISSIONS];

const meta = await call('');
const byTitle = new Map(meta.sheets.map((s) => [s.properties.title, s.properties]));

// The three registers first, so they sit leftmost in the tab bar.
const wanted = [...Object.keys(TRANSACTION), ...Object.keys(REFERENCE)];
const requests = [];

wanted.forEach((title, index) => {
  const hidden = title.startsWith('_');
  const existing = byTitle.get(title);
  if (!existing) {
    requests.push({
      addSheet: {
        properties: { title, index, hidden, gridProperties: { frozenRowCount: 1 } },
      },
    });
  } else {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: existing.sheetId, index, hidden,
                      gridProperties: { frozenRowCount: 1 } },
        fields: 'index,hidden,gridProperties.frozenRowCount',
      },
    });
  }
});

// Google creates a default "Sheet1" with every new spreadsheet. Remove it,
// but only when it is completely empty.
if (byTitle.has('Sheet1') && !wanted.includes('Sheet1')) {
  const cur = await call(`/values/${encodeURIComponent(`'Sheet1'`)}`);
  if (!(cur.values ?? []).length) {
    requests.push({ deleteSheet: { sheetId: byTitle.get('Sheet1').sheetId } });
  } else {
    console.log('  Sheet1 has content — left alone');
  }
}

// Remove the previous nine-tab layout, but never silently drop real data.
for (const title of LEGACY) {
  if (!byTitle.has(title) || wanted.includes(title)) continue;
  if (LEGACY_SUBMISSIONS.includes(title)) {
    const cur = await call(`/values/${encodeURIComponent(`'${title}'`)}`);
    const rows = cur.values ?? [];
    if (rows.length > 1) {
      console.error(
        `\nRefusing to delete old tab "${title}" — it still holds ${rows.length - 1} submitted row(s).\n` +
        'Download them from the admin Export page first, then delete the tab by hand and re-run.\n'
      );
      process.exit(1);
    }
  }
  requests.push({ deleteSheet: { sheetId: byTitle.get(title).sheetId } });
}

if (requests.length) {
  await call(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
  const made = requests.filter((r) => r.addSheet).map((r) => r.addSheet.properties.title);
  const gone = requests.filter((r) => r.deleteSheet).length;
  if (made.length) console.log(`created: ${made.join(', ')}`);
  if (gone) console.log(`removed ${gone} tab(s) from the previous layout`);
}

// ---- reference tabs: rewrite in full ------------------------------------
for (const [tab, { header, rows }] of Object.entries(REFERENCE)) {
  await call(`/values/${encodeURIComponent(`'${tab}'`)}:clear`, { method: 'POST' });
  await call(`/values/${encodeURIComponent(`'${tab}'`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [header, ...rows] }),
  });
  console.log(`  ${tab.padEnd(18)} ${String(rows.length).padStart(3)} rows (hidden)`);
}

// ---- submission tabs: only write headers when empty ---------------------
for (const [tab, header] of Object.entries(TRANSACTION)) {
  const cur = await call(`/values/${encodeURIComponent(`'${tab}'`)}`);
  const existing = cur.values ?? [];
  const sameShape =
    existing[0]?.length === header.length &&
    header.every((h, i) => existing[0][i] === h);

  if (existing[0]?.length && sameShape) {
    console.log(`  ${tab.padEnd(18)} already in use — left untouched`);
    continue;
  }
  if (existing.length > 1) {
    console.error(
      `\nTab "${tab}" has a different column layout but already holds ` +
      `${existing.length - 1} submitted row(s).\nDownload them from the admin ` +
      'Export page, run "npm run sheet:clear", then re-run this.\n'
    );
    process.exit(1);
  }
  if (existing[0]?.length) {
    await call(`/values/${encodeURIComponent(`'${tab}'`)}:clear`, { method: 'POST' });
    console.log(`  ${tab.padEnd(18)} column layout changed — header rebuilt`);
  }
  await call(`/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [header] }),
  });
  console.log(`  ${tab.padEnd(18)} ready (${header.length} columns)`);
}

console.log('\nSheet ready: https://docs.google.com/spreadsheets/d/' + SHEET_ID);
