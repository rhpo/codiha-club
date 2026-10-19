import { fail } from '@sveltejs/kit';
import { requireAdmin, requireContentManager, requireStaff } from '$lib/server/guards';
import { ROLES, ROLE_LABELS, assignableRoles, canAssignTo } from '$lib/roles.js';
import type { Role } from '$lib/types';
import { sendMail, wrapHtml } from '$lib/server/brevo';
import { loadTheme } from '$lib/server/settings';
import { derive, type Theme } from '$lib/theme';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const actor = await requireStaff(event);
	const sb = event.locals.supabase;

	const status = event.url.searchParams.get('status') ?? 'all';
	const q = (event.url.searchParams.get('q') ?? '').trim();

	// PostgREST `or()` is comma/paren delimited, so strip those out of user input
	const safeQ = q.replace(/[,()*%\\]/g, ' ').trim();

	let query = sb.from('profiles').select('*').order('created_at', { ascending: false });
	if (status !== 'all') query = query.eq('status', status);
	if (safeQ) {
		query = query.or(
			`full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,university.ilike.%${safeQ}%`
		);
	}

	const [members, points, counts] = await Promise.all([
		query.limit(400),
		sb.from('my_points').select('member_id,semester_points,total_points'),
		sb.from('profiles').select('status')
	]);

	const pointsBy: Record<string, { semester: number; total: number }> = {};
	for (const p of points.data ?? []) {
		pointsBy[p.member_id] = { semester: p.semester_points ?? 0, total: p.total_points ?? 0 };
	}

	const tally = { all: 0, pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
	for (const row of counts.data ?? []) {
		tally.all++;
		tally[row.status] = (tally[row.status] ?? 0) + 1;
	}

	return {
		members: members.data ?? [],
		// Staff see the list but get no role control; assignableRoles() is empty
		// for them, which is what hides the dropdown.
		assignable: assignableRoles(actor.role),
		actorRole: actor.role,
		actorId: actor.id,
		pointsBy,
		tally,
		filter: { status, q }
	};
};

async function notifyApproval(
	email: string | null,
	name: string,
	origin: string,
	theme: Theme
) {
	if (!email) return;
	const { accent, onAccent } = derive(theme);
	await sendMail({
		recipients: [{ email, name }],
		subject: 'Welcome to CODIHA Club, your membership is approved 🎉',
		html: wrapHtml(
			`<p>Hi ${name.split(' ')[0] || 'there'},</p>
			 <p>Your CODIHA Club membership has been <strong>approved</strong>. Your member dashboard is live:
			 points, event registrations, hackathon applications and certificates are all unlocked.</p>
			 <p style="margin:24px 0;">
			   <a href="${origin}/dashboard"
			      style="background:${accent};color:${onAccent};padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;">
			      Open my dashboard</a>
			 </p>
			 <p>See you at the next event!<br/>The CODIHA Club board</p>`,
			origin,
			theme
		)
	}).catch(() => {
		/* approval must not fail because the mail provider is down */
	});
}

export const actions: Actions = {
	approve: async (event) => {
		const admin = await requireStaff(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing member id' });

		const { data, error } = await event.locals.supabase
			.from('profiles')
			.update({
				status: 'approved',
				approved_at: new Date().toISOString(),
				approved_by: admin.id,
				reject_reason: null
			})
			.eq('id', id)
			.select('email,full_name')
			.maybeSingle();

		if (error) return fail(400, { error: error.message });
		await notifyApproval(
			data?.email ?? null,
			data?.full_name ?? '',
			event.url.origin,
			await loadTheme(event.locals.supabase)
		);
		return { success: `${data?.full_name || 'Member'} approved.` };
	},

	bulkApprove: async (event) => {
		const admin = await requireStaff(event);
		const form = await event.request.formData();
		const ids = form.getAll('ids').map(String).filter(Boolean);
		if (!ids.length) return fail(400, { error: 'Select at least one member.' });

		const { data, error } = await event.locals.supabase
			.from('profiles')
			.update({
				status: 'approved',
				approved_at: new Date().toISOString(),
				approved_by: admin.id,
				reject_reason: null
			})
			.in('id', ids)
			.select('email,full_name');

		if (error) return fail(400, { error: error.message });

		const theme = await loadTheme(event.locals.supabase);
		await Promise.all(
			(data ?? []).map((m) => notifyApproval(m.email, m.full_name ?? '', event.url.origin, theme))
		);
		return { success: `${data?.length ?? 0} members approved.` };
	},

	reject: async (event) => {
		await requireStaff(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const reason = String(form.get('reason') ?? '').trim();
		if (!id) return fail(400, { error: 'Missing member id' });
		if (!reason) return fail(400, { error: 'A rejection reason is required.' });

		const { error } = await event.locals.supabase
			.from('profiles')
			.update({ status: 'rejected', reject_reason: reason })
			.eq('id', id);

		if (error) return fail(400, { error: error.message });
		return { success: 'Member rejected.' };
	},

	points: async (event) => {
		const admin = await requireContentManager(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const amount = Number(form.get('amount'));
		const reason = String(form.get('reason') ?? '').trim();

		if (!id) return fail(400, { error: 'Missing member id' });
		if (!Number.isInteger(amount) || amount === 0) {
			return fail(400, { error: 'Points must be a non-zero whole number.' });
		}
		if (reason.length < 3) return fail(400, { error: 'A reason is required for every adjustment.' });

		const { error } = await event.locals.supabase.from('points_ledger').insert({
			member_id: id,
			amount,
			reason,
			source: 'manual',
			created_by: admin.id
		});

		if (error) return fail(400, { error: error.message });
		return { success: `${amount > 0 ? '+' : ''}${amount} points recorded.` };
	},

	setRole: async (event) => {
		const actor = await requireAdmin(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const role = String(form.get('role') ?? '');

		if (!ROLES.includes(role as Role)) return fail(400, { error: 'Invalid role' });
		if (id === actor.id) {
			return fail(400, { error: 'You cannot change your own role.' });
		}

		// Read the target first: the rules below depend on who they already are.
		const { data: target } = await event.locals.supabase
			.from('profiles')
			.select('role,full_name')
			.eq('id', id)
			.maybeSingle();
		if (!target) return fail(404, { error: 'Member not found.' });

		// No granting a rank above your own, and no touching someone who already
		// outranks you. Without this an admin could make themselves superadmin and
		// read every mailbox. The profiles_protect trigger enforces this again in
		// the database; this is the friendly error.
		if (!assignableRoles(actor.role).includes(role as Role)) {
			return fail(403, { error: `You cannot assign the ${ROLE_LABELS[role as Role]} role.` });
		}
		if (!canAssignTo(actor.role, target.role)) {
			return fail(403, { error: 'That member outranks you.' });
		}

		const { error } = await event.locals.supabase.from('profiles').update({ role }).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: `${target.full_name || 'Member'} is now ${ROLE_LABELS[role as Role]}.` };
	}
};
