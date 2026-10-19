import { fail, redirect } from '@sveltejs/kit';
import { uploadAvatar } from '$lib/server/upload';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await locals.getUser();
	if (!user) throw redirect(303, '/login?next=/onboarding');

	const profile = await locals.getProfile();
	if (profile?.onboarded_at && url.searchParams.get('edit') !== '1') {
		throw redirect(303, profile.status === 'approved' ? '/dashboard' : '/pending');
	}

	return { profile, email: user.email ?? null };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) throw redirect(303, '/login');

		const profileBefore = await locals.getProfile();
		const form = await request.formData();
		const str = (k: string) => String(form.get(k) ?? '').trim();

		const full_name = str('full_name');
		const university = str('university');
		const field = str('field');
		const year = str('year');

		const values = {
			full_name,
			university,
			field,
			year,
			discord: str('discord') || null,
			phone: str('phone') || null,
			github: str('github') || null,
			linkedin: str('linkedin') || null,
			bio: str('bio') || null
		};

		if (full_name.length < 3) return fail(400, { error: 'Please enter your full name.', values });
		if (!university) return fail(400, { error: 'Please pick your university.', values });
		if (!field) return fail(400, { error: 'Please pick your field of study.', values });
		if (!year) return fail(400, { error: 'Please pick your current year.', values });

		// A new picture is optional on every save; when none is supplied the
		// existing avatar_url is left alone by being absent from the patch.
		let uploadedAvatar: string | null = null;
		try {
			uploadedAvatar = await uploadAvatar(form.get('avatar'), user.id);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Picture upload failed', values });
		}

		// upsert, not update: an UPDATE matching zero rows is NOT an error in
		// PostgREST, so a member with no profile row (signed up before the
		// on_auth_user_created trigger existed, or the trigger failed) used to
		// bounce between /onboarding, /pending and /login forever with no
		// message. The insert path is allowed by profiles_insert_own, and role
		// and status keep their table defaults of 'member' and 'pending'.
		const { data: saved, error } = await locals.supabase
			.from('profiles')
			.upsert(
				{
					id: user.id,
					email: user.email ?? null,
					// New upload wins; otherwise keep whatever is already stored and fall
					// back to the picture the OAuth provider gave us on first sign-in.
					avatar_url:
						uploadedAvatar ??
						profileBefore?.avatar_url ??
						user.user_metadata?.avatar_url ??
						user.user_metadata?.picture ??
						null,
					...values,
					onboarded_at: new Date().toISOString()
				},
				{ onConflict: 'id' }
			)
			.select('status')
			.maybeSingle();

		if (error) return fail(500, { error: error.message, values });
		if (!saved) {
			return fail(500, {
				error: 'Your profile could not be saved. Please try again, or contact the club board.',
				values
			});
		}

		throw redirect(303, saved.status === 'approved' ? '/dashboard' : '/pending');
	}
};
