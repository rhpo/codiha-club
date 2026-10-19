import { createServerClient } from '@supabase/ssr';
import { error, redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { loadTheme } from '$lib/server/settings';
import { atLeast } from '$lib/roles.js';
import { themeCss } from '$lib/theme';
import type { Profile } from '$lib/types';

/** Empty tag sitting in src/app.html, swapped for the live palette below. */
const THEME_SLOT = '<style id="codiha-theme"></style>';

/** Paths that require a logged-in, approved member. */
const MEMBER_ONLY = ['/dashboard', '/vote', '/checkin', '/mail'];
/** Paths that require role = 'admin'. */
const ADMIN_ONLY = ['/admin'];

const startsWithAny = (path: string, prefixes: string[]) =>
	prefixes.some((p) => path === p || path.startsWith(p + '/'));

export const handle: Handle = async ({ event, resolve }) => {
	// Checked per request, not at module load, so `npm run build` still works on
	// a machine without secrets.
	if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
		throw error(
			500,
			'PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env ' +
				'(and add them to the Netlify environment variables). See README_PLATFORM.md.'
		);
	}

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: options.path ?? '/' });
				});
				try {
					// Auth cookie writes must not be cached by Netlify's CDN.
					if (headers && Object.keys(headers).length) event.setHeaders(headers);
				} catch {
					// setHeaders throws if the response already started. The cookie
					// above is what actually matters, so this is safe to ignore.
				}
			}
		}
	});

	// Cache per request: these are called by several load functions.
	let userPromise: Promise<any> | null = null;
	let profilePromise: Promise<Profile | null> | null = null;
	let themePromise: Promise<import('$lib/theme').Theme> | null = null;

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
					.from('profiles')
					.select('*')
					.eq('id', user.id)
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
			throw redirect(303, `/login?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
		}
		const profile = await event.locals.getProfile();
		if (!profile?.onboarded_at) throw redirect(303, '/onboarding');
		if (profile.status !== 'approved') throw redirect(303, '/pending');
		// 'staff' is the floor for /admin; each route then asks for the rank it
		// actually needs, and RLS refuses anything that slips through.
		if (needsAdmin && !atLeast(profile.role, 'staff')) throw redirect(303, '/dashboard');
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
						`<style id="codiha-theme">${themeCss(await event.locals.getTheme())}</style>`
					)
				: html,
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};
