import { createServerClient } from "@supabase/ssr";
import { error, redirect, type Handle } from "@sveltejs/kit";
import { building } from "$app/environment";
// Dynamic, not static. $env/static/public is inlined at BUILD time, so the
// build fails outright on any platform whose build environment has no vars
// set - which is what broke the first Cloudflare Pages deploy. Read at
// runtime instead, where the platform supplies them.
import { env as publicEnv } from "$env/dynamic/public";
import { loadTheme } from "$lib/server/settings";
import { atLeast, needsFacePhoto } from "$lib/roles.js";
import { profileComplete } from "$lib/profile.js";
import { themeCss } from "$lib/theme";
import type { Profile } from "$lib/types";

/** Empty tag sitting in src/app.html, swapped for the live palette below. */
const THEME_SLOT = '<style id="codiha-theme"></style>';

/** Paths that require a logged-in, approved member. */
const MEMBER_ONLY = ["/dashboard", "/vote", "/checkin", "/mail"];
/**
 * Reachable while a signed-in account is still incomplete, so the requirement
 * can never trap anybody: the two pages that fix it, the way out, the OAuth
 * callback, and the waiting room.
 */
const GATE_EXEMPT = ["/photo", "/onboarding", "/logout", "/auth", "/pending"];

/**
 * Never gated, whatever the account's state. Redirecting these would turn a
 * data fetch or a file download into a confusing 303 rather than a prompt.
 */
const NEVER_GATED = ["/api", "/certificates", "/verify", "/checkin"];
/** Paths that require role = 'admin'. */
const ADMIN_ONLY = ["/admin"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p + "/"));

export const handle: Handle = async ({ event, resolve }) => {
  // Checked per request, not at module load, so `npm run build` still works on
  // a machine without secrets.
  //
  // `building` is the exception: the Cloudflare adapter renders a static
  // fallback shell during the build, and that render runs this hook. The shell
  // needs no data - every accessor below already degrades to "signed out" on
  // error - so a build environment with no variables must not fail here. The
  // check still runs for real on the first request.
  const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;
  if (!building && (!supabaseUrl || !supabaseAnonKey)) {
    throw error(
      500,
      "PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env " +
        "(and add them to the deploy environment: Netlify site settings, or Cloudflare Pages variables). See README_PLATFORM.md."
    );
  }

  // Only reachable while building, per the check above. .invalid is a reserved
  // TLD that can never resolve, so these fail fast instead of reaching a host.
  const sbUrl = supabaseUrl ?? "https://unset.invalid";
  const sbKey = supabaseAnonKey ?? "unset";

  event.locals.supabase = createServerClient(sbUrl, sbKey, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, {
            ...options,
            path: options.path ?? "/",
          });
        });
        try {
          // Auth cookie writes must not be cached by Netlify's CDN.
          if (headers && Object.keys(headers).length) event.setHeaders(headers);
        } catch {
          // setHeaders throws if the response already started. The cookie
          // above is what actually matters, so this is safe to ignore.
        }
      },
    },
  });

  // Cache per request: these are called by several load functions.
  let userPromise: Promise<any> | null = null;
  let profilePromise: Promise<Profile | null> | null = null;
  let themePromise: Promise<import("$lib/theme").Theme> | null = null;

  event.locals.getUser = () => {
    if (!userPromise) {
      // A flaky auth server must not 500 the public pages, so treat it as signed out.
      userPromise = event.locals.supabase.auth
        .getUser()
        .then(({ data }) => data.user ?? null)
        .catch(() => null);
    }
    return userPromise;
  };

  event.locals.getSession = async () => {
    // getUser() hits the auth server, so the session we hand on is validated.
    const user = await event.locals.getUser();
    if (!user) return null;
    const { data } = await event.locals.supabase.auth.getSession();
    return data.session ?? null;
  };

  event.locals.getProfile = () => {
    if (!profilePromise) {
      profilePromise = (async () => {
        const user = await event.locals.getUser();
        if (!user) return null;
        const { data } = await event.locals.supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        return (data as Profile) ?? null;
      })().catch(() => null);
    }
    return profilePromise;
  };

  const path = event.url.pathname;
  const needsMember = startsWithAny(path, MEMBER_ONLY);
  const needsAdmin = startsWithAny(path, ADMIN_ONLY);

  if (needsMember || needsAdmin) {
    const user = await event.locals.getUser();
    if (!user) {
      throw redirect(
        303,
        `/login?next=${encodeURIComponent(
          event.url.pathname + event.url.search
        )}`
      );
    }
    const profile = await event.locals.getProfile();
    // Approval is checked here; completeness and the photo are handled by the
    // site-wide gate below, which also covers the public pages.
    if (profile && profile.status !== "approved")
      throw redirect(303, "/pending");
    // 'staff' is the floor for /admin; each route then asks for the rank it
    // actually needs, and RLS refuses anything that slips through.
    if (needsAdmin && !atLeast(profile?.role, "staff"))
      throw redirect(303, "/dashboard");
  }

  // ---- the two things every signed-in account must have ------------------
  //
  // Applied to the WHOLE site, not just the member area: somebody halfway
  // through signing up could otherwise browse /, /events and the rest
  // indefinitely and never be asked. Signed-out visitors are untouched, so
  // the public site is still public.
  if (!startsWithAny(path, GATE_EXEMPT) && !startsWithAny(path, NEVER_GATED)) {
    const user = await event.locals.getUser();
    if (user) {
      const profile = await event.locals.getProfile();
      const back = encodeURIComponent(path + event.url.search);

      // 1. Who are you? Required of every role, the Developer included.
      if (!profileComplete(profile)) {
        throw redirect(303, `/onboarding?next=${back}`);
      }

      // 2. What do you look like? Everyone but the Developer, who has to
      //    stay able to get in and fix a face check that is itself broken.
      if (needsFacePhoto(profile)) {
        throw redirect(303, `/photo?next=${back}`);
      }
    }
  }

  // The palette has to land in <head> before first paint, so it is injected
  // into the HTML shell rather than rendered by a layout component.
  event.locals.getTheme = () => {
    themePromise ??= loadTheme(event.locals.supabase);
    return themePromise;
  };

  return resolve(event, {
    transformPageChunk: async ({ html }) =>
      html.includes(THEME_SLOT)
        ? html.replace(
            THEME_SLOT,
            `<style id="codiha-theme">${themeCss(
              await event.locals.getTheme()
            )}</style>`
          )
        : html,
    filterSerializedResponseHeaders: (name) =>
      name === "content-range" || name === "x-supabase-api-version",
  });
};
