import { fail, redirect } from '@sveltejs/kit';
import { requireMember } from '$lib/server/guards';
import { uploadAvatar } from '$lib/server/upload';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { needsFacePhoto } from '$lib/roles.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const profile = await requireMember(event);

	// Already sorted, or exempt: nothing to do here.
	if (!needsFacePhoto(profile)) {
		throw redirect(303, event.url.searchParams.get('next') ?? '/dashboard');
	}

	return { profile, next: event.url.searchParams.get('next') ?? '/dashboard' };
};

export const actions: Actions = {
	default: async (event) => {
		const profile = await requireMember(event);
		const form = await event.request.formData();

		// The browser reports what its detector found. It is not trustworthy on
		// its own, which is why it only ever sets a flag an admin can review,
		// never grants access to anything.
		const detected = String(form.get('face_detected') ?? '') === '1';

		let url: string | null = null;
		try {
			url = await uploadAvatar(form.get('avatar'), profile.id);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Upload failed' });
		}
		if (!url) return fail(400, { error: 'Choose a photo first.' });

		// avatar_face_verified is write-protected against members by the
		// profiles_protect trigger, so this has to go through the service role.
		const { error } = await supabaseAdmin()
			.from('profiles')
			.update({
				avatar_url: url,
				avatar_face_verified: detected,
				avatar_verified_at: detected ? new Date().toISOString() : null
			})
			.eq('id', profile.id);

		if (error) return fail(500, { error: error.message });

		if (!detected) {
			return {
				success:
					'Photo saved. The automatic face check did not pass, so an admin will confirm it.'
			};
		}

		const next = String(form.get('next') ?? '/dashboard');
		throw redirect(303, next.startsWith('/') ? next : '/dashboard');
	}
};
