"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client. Anon key — reference data reads only, never writes. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
