import "server-only";
import { sheetsBackend } from "./sheets-backend";
import { supabaseBackend } from "./supabase-backend";
import type { Backend } from "./contract";

/**
 * Backend selection.
 *
 * DATA_BACKEND=sheets   → Google Sheets (default)
 * DATA_BACKEND=supabase → Postgres
 *
 * Both implement `Backend` in ./contract.ts, so switching is this env var —
 * nothing under app/ knows which one is in use.
 */
export function backend(): Backend {
  return process.env.DATA_BACKEND === "supabase" ? supabaseBackend : sheetsBackend;
}

export function backendName(): "sheets" | "supabase" {
  return backend().name;
}

export function isBackendConfigured(): boolean {
  try {
    return backend().isConfigured();
  } catch {
    return false;
  }
}

export * from "./contract";
