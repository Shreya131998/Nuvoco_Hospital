import { NextResponse } from "next/server";

/** These endpoints are reachable by anyone with the form URL, so every
 *  field is validated here rather than trusted from the client. */

export class BadRequest extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function str(v: unknown, field: string, max = 200): string {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${field} is required`);
  const s = v.trim();
  if (s.length > max) throw new BadRequest(`${field} is too long`);
  return s;
}

/**
 * A person's typed name. Names are free text (no staff list), so the dashboard
 * groups on whatever is entered. Trim and collapse inner whitespace so
 * "ramesh   kumar" and "ramesh kumar " are the same person. Case and spelling
 * are left alone — normalising further would mangle names like "O.P SINGH".
 */
export function personName(v: unknown, field: string): string {
  return str(v, field, 80).replace(/\s+/g, " ");
}

/** Same normalisation as personName, but the field may be left blank. */
export function optPersonName(v: unknown, field: string): string | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  return personName(v, field);
}

export function optStr(v: unknown, field: string, max = 2000): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new BadRequest(`${field} must be text`);
  const s = v.trim();
  if (!s) return null;
  if (s.length > max) throw new BadRequest(`${field} is too long`);
  return s;
}

export function uuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new BadRequest(`${field} is invalid`);
  return v;
}

export function optUuid(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  return uuid(v, field);
}

export function date(v: unknown, field: string): string {
  if (typeof v !== "string" || !DATE_RE.test(v) || Number.isNaN(Date.parse(v)))
    throw new BadRequest(`${field} must be a valid date`);
  return v;
}

export function optDate(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  return date(v, field);
}

export function int(v: unknown, field: string, min = 0, max = 9999): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new BadRequest(`${field} must be a whole number between ${min} and ${max}`);
  return n;
}

export function optInt(v: unknown, field: string, min = 0, max = 9999): number | null {
  if (v === null || v === undefined || v === "") return null;
  return int(v, field, min, max);
}

export function arr<T>(v: unknown, field: string, max: number): T[] {
  if (!Array.isArray(v)) throw new BadRequest(`${field} is invalid`);
  if (v.length > max) throw new BadRequest(`${field} has too many entries`);
  return v as T[];
}

export function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new BadRequest(`${field} must be true or false`);
  return v;
}

/** Optional single shared plant code. Blank env var = forms stay fully open. */
export function checkAccessCode(req: Request) {
  const expected = process.env.PLANT_ACCESS_CODE;
  if (!expected) return;
  if (req.headers.get("x-plant-code") !== expected)
    throw new BadRequest("Invalid plant access code");
}

export function fail(e: unknown) {
  if (e instanceof BadRequest) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  console.error("[api]", e);
  return NextResponse.json(
    { error: "Could not save. Please try again." },
    { status: 500 }
  );
}
