/**
 * Clears the three submission tabs, keeping their header rows.
 * Reference tabs are never touched. Use before go-live to remove test entries.
 *
 *   npm run sheet:clear
 */
import { readFileSync } from 'node:fs';
import { JWT } from 'google-auth-library';

for (const file of ['.env.local', '.env']) {
  try {
    readFileSync(file, 'utf8').split('\n').forEach((line) => {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) return;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    });
  } catch { /* optional */ }
}

const ID = process.env.GOOGLE_SHEETS_ID;
const OVERRIDE = process.env.GOOGLE_SHEETS_API_BASE;
const LOCAL = Boolean(OVERRIDE && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(OVERRIDE));
if (!ID) { console.error('GOOGLE_SHEETS_ID is not set'); process.exit(1); }

const auth = LOCAL ? null : new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const API = `${LOCAL ? OVERRIDE : 'https://sheets.googleapis.com/v4/spreadsheets'}/${ID}`;

async function call(path, init) {
  const token = LOCAL ? 'local-stub' : (await auth.getAccessToken()).token;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

for (const tab of ['First Aid Kit', 'Ambulance Check', 'Medicine Check']) {
  const cur = await call(`/values/${encodeURIComponent(`'${tab}'`)}`);
  const rows = cur.values ?? [];
  const header = rows[0];
  if (!header?.length) { console.log(`  ${tab.padEnd(20)} no header — skipped`); continue; }
  await call(`/values/${encodeURIComponent(`'${tab}'`)}:clear`, { method: 'POST' });
  await call(`/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ values: [header] }),
  });
  console.log(`  ${tab.padEnd(20)} cleared ${Math.max(0, rows.length - 1)} row(s), header kept`);
}
console.log('\nSubmission tabs are empty. Reference tabs untouched.');
