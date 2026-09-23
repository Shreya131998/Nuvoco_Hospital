import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is the ONLY writer into the
 * database and must never be imported into a client component.
 *
 * Every public form posts to a server route that validates input and then
 * writes through this client. That keeps the anon key read-only, which
 * matters because the forms are open to anyone with the URL.
 */
export function createAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
