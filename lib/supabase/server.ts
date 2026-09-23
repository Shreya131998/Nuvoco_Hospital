import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client carrying the admin's auth cookie. Queries run as the
 * `authenticated` role, so RLS still applies — this cannot read anything
 * an admin is not entitled to.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — refreshing happens in middleware.
          }
        },
      },
    }
  );
}
