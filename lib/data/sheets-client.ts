import "server-only";
import { JWT } from "google-auth-library";

/**
 * Thin Google Sheets v4 client.
 *
 * Two rules keep this usable as a real backend:
 *   1. Reads go through batchGet — one HTTP request for many tabs. The Sheets
 *      API allows 60 reads/minute/user, and a dashboard page touches 5+ tabs.
 *   2. Writes are append-only. Updating a row requires read-then-write on a
 *      row index, which races when two shifts submit at once; appending does
 *      not. Duplicates are resolved on read instead (latest wins).
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const GOOGLE_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Optional override pointing at a local stand-in for the Sheets API, for
 * development and tests without burning Google quota. OAuth is skipped ONLY
 * when this points at loopback, so it can never disable auth against Google.
 */
function apiBase(): string {
  const override = process.env.GOOGLE_SHEETS_API_BASE;
  return override && isLoopback(override) ? override : GOOGLE_API;
}

function isLoopback(url: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);
}

function usingLocalStub(): boolean {
  const o = process.env.GOOGLE_SHEETS_API_BASE;
  return Boolean(o && isLoopback(o));
}

let cachedClient: JWT | null = null;

function auth(): JWT {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set"
    );
  }
  cachedClient = new JWT({
    email,
    // .env files can't hold real newlines, so the key is stored escaped.
    key: key.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
  return cachedClient;
}

function sheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID is not set");
  return id;
}

async function token(): Promise<string> {
  if (usingLocalStub()) return "local-stub";
  const res = await auth().getAccessToken();
  const t = typeof res === "string" ? res : res?.token;
  if (!t) throw new Error("Could not obtain a Google access token");
  return t;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/${sheetId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/**
 * A1 notation for a whole tab, or a row range within it. Sheet names
 * containing spaces must be single-quoted, and literal quotes doubled —
 * "First Aid Kit" would otherwise be parsed as three tokens.
 */
export function a1(tab: string, range?: string): string {
  const quoted = `'${tab.replace(/'/g, "''")}'`;
  return range ? `${quoted}!${range}` : quoted;
}

/** Read several whole tabs in ONE request. Missing tabs come back empty. */
export async function readTabs(
  tabs: string[]
): Promise<Record<string, string[][]>> {
  if (tabs.length === 0) return {};
  const qs = tabs.map((t) => `ranges=${encodeURIComponent(a1(t))}`).join("&");
  const json = await call<{
    valueRanges?: { range: string; values?: string[][] }[];
  }>(`/values:batchGet?${qs}&majorDimension=ROWS`);

  const out: Record<string, string[][]> = {};
  tabs.forEach((tab, i) => {
    out[tab] = json.valueRanges?.[i]?.values ?? [];
  });
  return out;
}

export async function readTab(tab: string): Promise<string[][]> {
  return (await readTabs([tab]))[tab] ?? [];
}

/** Append rows to the bottom of a tab. Google serialises appends server-side. */
export async function appendRows(tab: string, rows: unknown[][]): Promise<void> {
  if (rows.length === 0) return;
  await call(
    `/values/${encodeURIComponent(a1(tab))}:append` +
      `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rows }) }
  );
}

/** Replace a tab's contents entirely. Only used for reference data. */
export async function overwriteTab(tab: string, rows: unknown[][]): Promise<void> {
  await call(`/values/${encodeURIComponent(a1(tab))}:clear`, { method: "POST" });
  if (rows.length === 0) return;
  await call(
    `/values/${encodeURIComponent(a1(tab))}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: rows }) }
  );
}

/** Turn a sheet's [header, ...rows] into objects keyed by header. */
export function toObjects(grid: string[][]): Record<string, string>[] {
  if (grid.length < 2) return [];
  const [header, ...rows] = grid;
  return rows
    .filter((r) => r.some((c) => (c ?? "").toString().trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, i) => (o[h] = (r[i] ?? "").toString()));
      return o;
    });
}

export function isSheetsConfigured(): boolean {
  if (!process.env.GOOGLE_SHEETS_ID) return false;
  if (usingLocalStub()) return true;
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );
}
