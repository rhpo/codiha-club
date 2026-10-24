import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTheme, type Theme } from "$lib/theme";
import { ALWAYS_OPEN, resolveWindow } from "$lib/applications.js";
import type { ApplicationWindow } from "$lib/applications.js";

/**
 * The saved palette. Read on every request to inject the CSS variables, so it
 * is cached briefly in memory: the row changes maybe twice a year, and a
 * round trip per page view for it would be wasteful.
 *
 * ponytail: a process-local cache is enough. Netlify runs several lambdas, so
 * a palette change can take up to TTL to show up everywhere.
 */
const TTL_MS = 60_000;
let cached: { theme: Theme; at: number } | null = null;

export async function loadTheme(sb: SupabaseClient): Promise<Theme> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.theme;
  try {
    const { data } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "theme")
      .maybeSingle();
    const theme = resolveTheme(data?.value as never);
    cached = { theme, at: Date.now() };
    return theme;
  } catch {
    return cached?.theme ?? resolveTheme(null);
  }
}

/** Called after an admin saves, so the next request does not serve a stale palette. */
export function invalidateThemeCache(): void {
  cached = null;
}

/**
 * When the club is accepting applications.
 *
 * Deliberately uncached, unlike the palette: a countdown that is up to a
 * minute stale can tell somebody intake is still open after it has shut.
 */
export async function loadApplicationWindow(
  sb: SupabaseClient
): Promise<ApplicationWindow> {
  try {
    const { data } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "applications")
      .maybeSingle();
    return resolveWindow(data?.value);
  } catch {
    // Never lock people out because a settings read failed.
    return ALWAYS_OPEN;
  }
}
