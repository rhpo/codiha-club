import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

let cached: SupabaseClient | null = null;

/**
 * Service-role client that bypasses RLS. Only ever reachable from server code,
 * and only after the caller has been authorised (see `requireAdmin`) or the
 * request carries a valid HMAC check-in token.
 */
export function supabaseAdmin(): SupabaseClient {
	if (cached) return cached;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
	cached = createClient(PUBLIC_SUPABASE_URL, key, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	return cached;
}
