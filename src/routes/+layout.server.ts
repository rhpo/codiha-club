import type { LayoutServerLoad } from './$types';

/**
 * Session + profile are needed by the nav on every page. The palette is here
 * for the admin preview; the CSS itself is injected into <head> by
 * hooks.server.ts so it is applied before first paint.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const profile = await locals.getProfile();

	return {
		session: await locals.getSession(),
		profile,
		theme: await locals.getTheme()
	};
};
