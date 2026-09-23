/**
 * Minimal in-memory stand-in for the Google Sheets v4 API.
 *
 * Implements only what lib/data/sheets-client.ts calls, so the real adapter
 * can be exercised without Google credentials or quota:
 *   GET    /v4/spreadsheets/:id
 *   GET    /v4/spreadsheets/:id/values:batchGet?ranges=...
 *   GET    /v4/spreadsheets/:id/values/:range
 *   PUT    /v4/spreadsheets/:id/values/:range
 *   POST   /v4/spreadsheets/:id/values/:range:append
 *   POST   /v4/spreadsheets/:id/values/:range:clear
 *   POST   /v4/spreadsheets/:id:batchUpdate      (addSheet only)
 *
 * Not a Google emulator — no formats, formulas or permissions.
 */
import { createServer } from 'node:http';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const PORT = Number(process.env.FAKE_SHEETS_PORT ?? 8787);
const STATE = process.env.FAKE_SHEETS_STATE ?? '';

/** tab name -> array of rows */
const tabs = new Map();
if (STATE && existsSync(STATE)) {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(STATE, 'utf8')))) tabs.set(k, v);
}
const persist = () => {
  if (STATE) writeFileSync(STATE, JSON.stringify(Object.fromEntries(tabs), null, 0));
};

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

/** "tab" or "tab!A1" or "tab!1:1" -> { tab, rowFrom, rowTo } */
function parseRange(raw) {
  const decoded = decodeURIComponent(raw);
  const bang = decoded.indexOf('!');
  if (bang === -1) return { tab: decoded, rowFrom: null, rowTo: null };
  const tab = decoded.slice(0, bang);
  const a1 = decoded.slice(bang + 1);
  const m = /^(?:[A-Z]*)(\d+)(?::(?:[A-Z]*)(\d+))?$/.exec(a1);
  if (!m) return { tab, rowFrom: null, rowTo: null };
  return { tab, rowFrom: Number(m[1]), rowTo: m[2] ? Number(m[2]) : Number(m[1]) };
}

function slice(tab, rowFrom, rowTo) {
  const rows = tabs.get(tab) ?? [];
  if (rowFrom === null) return rows;
  return rows.slice(rowFrom - 1, rowTo);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  let body = '';
  for await (const chunk of req) body += chunk;
  const payload = body ? JSON.parse(body) : {};

  const base = /^\/v4\/spreadsheets\/([^/:]+)/.exec(path);
  if (!base) return json(res, 404, { error: 'not found' });
  const rest = path.slice(base[0].length);

  // metadata
  if (req.method === 'GET' && rest === '') {
    return json(res, 200, {
      spreadsheetId: base[1],
      sheets: [...tabs.keys()].map((title) => ({ properties: { title } })),
    });
  }

  // :batchUpdate — addSheet only
  if (req.method === 'POST' && rest === ':batchUpdate') {
    (payload.requests ?? []).forEach((r) => {
      const title = r.addSheet?.properties?.title;
      if (title && !tabs.has(title)) tabs.set(title, []);
    });
    persist();
    return json(res, 200, { replies: [] });
  }

  // values:batchGet
  if (req.method === 'GET' && rest.startsWith('/values:batchGet')) {
    const ranges = url.searchParams.getAll('ranges');
    return json(res, 200, {
      valueRanges: ranges.map((r) => {
        const { tab, rowFrom, rowTo } = parseRange(r);
        return { range: r, values: slice(tab, rowFrom, rowTo) };
      }),
    });
  }

  const vm = /^\/values\/(.+?)(:append|:clear)?$/.exec(rest);
  if (vm) {
    const { tab, rowFrom, rowTo } = parseRange(vm[1]);
    const op = vm[2];

    if (req.method === 'POST' && op === ':clear') {
      tabs.set(tab, []);
      persist();
      return json(res, 200, { clearedRange: tab });
    }

    if (req.method === 'POST' && op === ':append') {
      if (!tabs.has(tab)) tabs.set(tab, []);
      tabs.get(tab).push(...(payload.values ?? []).map((r) => r.map((c) => (c ?? '').toString())));
      persist();
      return json(res, 200, { updates: { updatedRows: (payload.values ?? []).length } });
    }

    if (req.method === 'PUT') {
      const incoming = (payload.values ?? []).map((r) => r.map((c) => (c ?? '').toString()));
      if (rowFrom === null) {
        tabs.set(tab, incoming);
      } else {
        const rows = tabs.get(tab) ?? [];
        incoming.forEach((r, i) => { rows[rowFrom - 1 + i] = r; });
        tabs.set(tab, rows);
      }
      persist();
      return json(res, 200, { updatedRows: incoming.length });
    }

    if (req.method === 'GET') {
      return json(res, 200, { range: vm[1], values: slice(tab, rowFrom, rowTo) });
    }
  }

  return json(res, 404, { error: `unhandled ${req.method} ${path}` });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fake sheets api on http://127.0.0.1:${PORT}`);
});
