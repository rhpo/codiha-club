import { fail } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { Actions, PageServerLoad } from './$types';

/**
 * Anyone can write to the club here, signed in or not, so nothing on this
 * page is behind a guard.
 *
 * The row is written with the service role rather than by the visitor: the
 * table has no insert policy at all, which keeps a public form from being a
 * public write to the database. Everything that decides whether a message is
 * worth keeping is checked here first.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Long enough to be a message, short enough not to be a payload. */
const LIMITS = {
	name: [2, 80],
	subject: [0, 140],
	body: [10, 4000]
} as const;

export const load: PageServerLoad = async ({ locals }) => {
	// Only to prefill the form for somebody already signed in. The page works
	// perfectly well with nothing here.
	const profile = await locals.getProfile();
	return {
		me: profile ? { full_name: profile.full_name, email: profile.email } : null
	};
};

export const actions: Actions = {
	send: async (event) => {
		const form = await event.request.formData();
		const str = (k: string) => String(form.get(k) ?? '').trim();

		// A field hidden from people and irresistible to bots. Anything that
		// fills it is told the message was sent, and nothing is stored.
		if (str('company')) return { success: 'Thanks - we will get back to you.' };

		const name = str('name');
		const email = str('email');
		const subject = str('subject');
		const body = str('body');
		const values = { name, email, subject, body };

		if (name.length < LIMITS.name[0] || name.length > LIMITS.name[1]) {
			return fail(400, { error: 'Please tell us your name.', values });
		}
		if (!EMAIL.test(email)) {
			return fail(400, { error: 'That email address does not look right.', values });
		}
		if (subject.length > LIMITS.subject[1]) {
			return fail(400, { error: 'That subject is too long.', values });
		}
		if (body.length < LIMITS.body[0]) {
			return fail(400, { error: 'Please write a little more so we can help.', values });
		}
		if (body.length > LIMITS.body[1]) {
			return fail(400, { error: 'That message is too long.', values });
		}

		const admin = supabaseAdmin();

		// One message per address per minute. Not a defence against anybody
		// determined, just enough that a stuck submit button or a crude script
		// does not fill the inbox.
		const since = new Date(Date.now() - 60_000).toISOString();
		const { count } = await admin
			.from('contact_messages')
			.select('id', { count: 'exact', head: true })
			.eq('email', email)
			.gte('created_at', since);
		if ((count ?? 0) > 0) {
			return fail(429, {
				error: 'You just sent us one. Give us a moment to read it.',
				values
			});
		}

		const profile = await event.locals.getProfile();
		const { error } = await admin.from('contact_messages').insert({
			name,
			email,
			subject: subject || null,
			body,
			member_id: profile?.id ?? null
		});
		if (error) return fail(400, { error: error.message, values });

		return { success: 'Message sent. Someone from the board will read it.' };
	}
};
