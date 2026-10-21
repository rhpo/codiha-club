import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// Dynamic, not static. $env/static/public is inlined at BUILD time, so the
// build fails outright on any platform whose build environment has no vars
// set - which is what broke the first Cloudflare Pages deploy. Read at
// runtime instead, where the platform supplies them.
import { env as publicEnv } from "$env/dynamic/public";
import { env } from "$env/dynamic/private";

let cached: SupabaseClient | null = null;

/**
 * Service-role client that bypasses RLS. Only ever reachable from server code,
 * and only after the caller has been authorised (see `requireAdmin`) or the
 * request carries a valid HMAC check-in token.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const url = publicEnv.PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("PUBLIC_SUPABASE_URL is not set");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
