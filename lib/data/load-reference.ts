import "server-only";
import { backend, isBackendConfigured, type Reference } from "@/lib/data";

/**
 * Fetches form reference data and flattens every failure mode into one shape,
 * so pages can branch on plain values instead of wrapping JSX in a try/catch
 * (which would not catch render errors anyway).
 */
export async function loadReference(): Promise<
  { ok: true; ref: Reference } | { ok: false; detail?: string }
> {
  if (!isBackendConfigured()) return { ok: false };
  try {
    const ref = await backend().getReference();
    if (ref.error) return { ok: false, detail: ref.error.message };
    return { ok: true, ref };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
