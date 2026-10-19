import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendMail, wrapHtml } from '$lib/server/brevo';
import { loadTheme } from '$lib/server/settings';
import { derive } from '$lib/theme';
import { ROLES, ROLE_LABELS, assignableRoles, canAssignTo } from '$lib/roles.js';
import type { Role } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const actor = await requireAdmin(event);
	const sb = event.locals.supabase;

	const q = (event.url.searchParams.get('q') ?? '').trim();
	const roleFilter = event.url.searchParams.get('role') ?? 'staff+';

	let query = sb
		.from('profiles')
		.select('id,full_name,email,avatar_url,university,role,status,created_at')
		.order('created_at', { ascending: false });

	// Default view is "people with a job", because the members list already
	// covers everyone else.
	if (roleFilter === 'staff+') query = query.neq('role', 'member');
	else if (roleFilter !== 'all') query = query.eq('role', roleFilter);

	const safeQ = q.replace(/[,()*%\\]/g, ' ').trim();
	if (safeQ) query = query.or(`full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);

	const [people, tallyRows] = await Promise.all([
		query.limit(300),
		sb.from('profiles').select('role')
	]);

	const tally: Record<string, number> = { all: 0 };
	for (const row of tallyRows.data ?? []) {
		tally.all++;
		tally[row.role] = (tally[row.role] ?? 0) + 1;
	}

	return {
		people: people.data ?? [],
		tally,
		filter: { q, role: roleFilter },
		// What this particular admin is allowed to hand out.
		assignable: assignableRoles(actor.role),
		actorId: actor.id,
		actorRole: actor.role
	};
};

export const actions: Actions = {
	/**
	 * Invite by email. Supabase creates the auth user and emails a magic link;
	 * the handle_new_user trigger makes the profile, and the role is applied on
	 * top. They still complete onboarding themselves.
	 */
	invite: async (event) => {
		const actor = await requireAdmin(event);
		const form = await event.request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const role = String(form.get('role') ?? 'member');
		const fullName = String(form.get('full_name') ?? '').trim();

		if (!email.includes('@')) return fail(400, { error: 'Enter a valid email address.' });
		if (!ROLES.includes(role as Role)) return fail(400, { error: 'Invalid role.' });
		if (!assignableRoles(actor.role).includes(role as Role)) {
			return fail(403, { error: `You cannot assign the ${ROLE_LABELS[role as Role]} role.` });
		}

		const admin = supabaseAdmin();

		const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
			redirectTo: `${event.url.origin}/auth/callback?next=/onboarding`,
			data: { full_name: fullName || undefined }
		});

		if (inviteError) {
			// Already has an account: promote the existing profile instead of
			// failing, which is what the admin meant anyway.
			const { data: existing } = await admin
				.from('profiles')
				.select('id,role')
				.ilike('email', email)
				.maybeSingle();

			if (!existing) return fail(400, { error: inviteError.message });
			if (!canAssignTo(actor.role, existing.role)) {
				return fail(403, { error: 'That person outranks you.' });
			}
			await admin
				.from('profiles')
				.update({
					role,
					status: 'approved',
					approved_at: new Date().toISOString(),
					approved_by: actor.id
				})
				.eq('id', existing.id);
			return { success: `${email} already had an account and is now ${ROLE_LABELS[role as Role]}.` };
		}

		const newId = invited?.user?.id;
		if (newId) {
			// Invited people are pre-approved: an admin vouched for them, so making
			// them queue for approval would be silly.
			await admin
				.from('profiles')
				.update({
					role,
					full_name: fullName || '',
					status: 'approved',
					approved_at: new Date().toISOString(),
					approved_by: actor.id
				})
				.eq('id', newId);
		}

		const theme = await loadTheme(event.locals.supabase);
		const { accent, onAccent } = derive(theme);
		await sendMail({
			recipients: [{ email, name: fullName || undefined }],
			subject: 'You have been added to the CODIHA Club platform',
			html: wrapHtml(
				`<p>Hi${fullName ? ' ' + fullName.split(' ')[0] : ''},</p>
				 <p>You have been added to the CODIHA Club platform as
				 <strong>${ROLE_LABELS[role as Role]}</strong>.</p>
				 <p style="margin:24px 0;">
				   <a href="${event.url.origin}/login"
				      style="background:${accent};color:${onAccent};padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;">
				      Sign in</a>
				 </p>
				 <p>Sign in with the Google or Discord account on this address.</p>`,
				event.url.origin,
				theme
			)
		}).catch(() => {
			/* the invite itself already worked; mail is a nicety */
		});

		return { success: `Invited ${email} as ${ROLE_LABELS[role as Role]}.` };
	},

	setRole: async (event) => {
		const actor = await requireAdmin(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const role = String(form.get('role') ?? '');

		if (!ROLES.includes(role as Role)) return fail(400, { error: 'Invalid role.' });
		if (id === actor.id) return fail(400, { error: 'You cannot change your own role.' });

		const { data: target } = await event.locals.supabase
			.from('profiles')
			.select('role,full_name')
			.eq('id', id)
			.maybeSingle();
		if (!target) return fail(404, { error: 'Member not found.' });

		// Both checks matter: the first stops you handing out a rank you do not
		// hold, the second stops two admins demoting each other. The
		// profiles_protect trigger repeats both in the database.
		if (!assignableRoles(actor.role).includes(role as Role)) {
			return fail(403, { error: `You cannot assign the ${ROLE_LABELS[role as Role]} role.` });
		}
		if (!canAssignTo(actor.role, target.role)) {
			return fail(403, { error: 'That person outranks you.' });
		}

		const { error } = await event.locals.supabase.from('profiles').update({ role }).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: `${target.full_name || 'Member'} is now ${ROLE_LABELS[role as Role]}.` };
	}
};
