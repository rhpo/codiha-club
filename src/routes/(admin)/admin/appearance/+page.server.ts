import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import { invalidateThemeCache } from '$lib/server/settings';
import { DEFAULT_THEME, normalizeHex } from '$lib/theme';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireAdmin(event);
	// The palette itself already comes down from the root layout load.
	const { data } = await event.locals.supabase
		.from('site_settings')
		.select('updated_at')
		.eq('key', 'theme')
		.maybeSingle();

	return { updatedAt: data?.updated_at ?? null };
};

export const actions: Actions = {
	save: async (event) => {
		const admin = await requireAdmin(event);
		const form = await event.request.formData();

		const primary = normalizeHex(form.get('primary'));
		const accent = normalizeHex(form.get('accent'));
		const text = normalizeHex(form.get('text'));
		if (!primary || !accent || !text) {
			return fail(400, { error: 'Every colour must be a hex value like #294230.' });
		}

		const { error } = await event.locals.supabase.from('site_settings').upsert(
			{
				key: 'theme',
				value: { primary, accent, text },
				updated_at: new Date().toISOString(),
				updated_by: admin.id
			},
			{ onConflict: 'key' }
		);
		if (error) return fail(500, { error: error.message });
		invalidateThemeCache();

		return { success: 'Palette saved. It applies site-wide right away.' };
	},

	reset: async (event) => {
		const admin = await requireAdmin(event);
		const { error } = await event.locals.supabase.from('site_settings').upsert(
			{
				key: 'theme',
				value: DEFAULT_THEME,
				updated_at: new Date().toISOString(),
				updated_by: admin.id
			},
			{ onConflict: 'key' }
		);
		if (error) return fail(500, { error: error.message });
		invalidateThemeCache();

		return { success: 'Palette reset to the CODIHA defaults.' };
	}
};
