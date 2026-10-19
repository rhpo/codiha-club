import { error, fail, redirect } from '@sveltejs/kit';
import { requireContentManager, requireStaff } from '$lib/server/guards';
import { localToUtcIso, tzOffsetFrom } from '$lib/server/datetime';
import { uploadCover } from '$lib/server/upload';
import { sendMail, wrapHtml } from '$lib/server/brevo';
import { loadTheme } from '$lib/server/settings';
import type { Theme } from '$lib/theme';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// staff need to read the page to act on applications
	await requireStaff(event);
	const sb = event.locals.supabase;

	const { data: hackathon } = await sb
		.from('hackathons')
		.select('*')
		.eq('id', event.params.id)
		.maybeSingle();
	if (!hackathon) throw error(404, 'Hackathon not found');

	const [apps, winners, certs] = await Promise.all([
		sb
			.from('hackathon_applications')
			.select('*,profiles:member_id(full_name,email,avatar_url,university,field,year)')
			.eq('hackathon_id', hackathon.id)
			.order('created_at', { ascending: true }),
		sb.from('hackathon_winners').select('*').eq('hackathon_id', hackathon.id).order('place'),
		sb
			.from('certificates')
			.select('id', { count: 'exact', head: true })
			.eq('hackathon_id', hackathon.id)
	]);

	const list = apps.data ?? [];
	return {
		hackathon,
		applications: list,
		accepted: list.filter((a: any) => a.status === 'accepted'),
		winners: winners.data ?? [],
		certificateCount: certs.count ?? 0
	};
};

async function mailDecision(
	status: 'accepted' | 'rejected',
	rows: { email: string | null; full_name: string | null }[],
	hackathonTitle: string,
	slug: string,
	origin: string,
	theme: Theme
) {
	const recipients = rows
		.filter((r) => r.email)
		.map((r) => ({ email: r.email as string, name: r.full_name ?? undefined }));
	if (!recipients.length) return;

	const body =
		status === 'accepted'
			? `<p>Good news. Your application to <strong>${hackathonTitle}</strong> has been
			   <strong>accepted</strong>! Your participation certificate is already waiting in your
			   dashboard.</p>
			   <p><a href="${origin}/hackathons/${slug}" style="color:${theme.accent};">Hackathon page →</a></p>`
			: `<p>Thanks for applying to <strong>${hackathonTitle}</strong>. This time we couldn't give
			   you a place, because we had more applications than seats. Please apply again for the next
			   edition, and keep collecting points at our events in the meantime.</p>`;

	await sendMail({
		recipients,
		subject: `${hackathonTitle}: application ${status}`,
		html: wrapHtml(body, origin, theme)
	}).catch(() => {
		/* decisions must not depend on the mail provider */
	});
}

export const actions: Actions = {
	update: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const tz = tzOffsetFrom(form);
		const str = (k: string) => String(form.get(k) ?? '').trim();
		const num = (k: string, fallback: number) => {
			const n = Number(str(k));
			return Number.isFinite(n) ? n : fallback;
		};

		const starts_at = localToUtcIso(form.get('starts_at'), tz);
		const ends_at = localToUtcIso(form.get('ends_at'), tz);
		if (!starts_at || !ends_at) return fail(400, { error: 'Start and end dates are required.' });
		if (new Date(ends_at) <= new Date(starts_at)) {
			return fail(400, { error: 'The end date must be after the start date.' });
		}

		const patch: Record<string, unknown> = {
			title: str('title'),
			slug: str('slug'),
			theme: str('theme') || null,
			summary: str('summary') || null,
			description: str('description') || null,
			location: str('location') || null,
			prize_pool: str('prize_pool') || null,
			starts_at,
			ends_at,
			apply_opens_at: localToUtcIso(form.get('apply_opens_at'), tz),
			apply_deadline: localToUtcIso(form.get('apply_deadline'), tz),
			capacity: str('capacity') ? Number(str('capacity')) : null,
			team_size_min: num('team_size_min', 1),
			team_size_max: num('team_size_max', 4),
			points_participation: num('points_participation', 25),
			points_first: num('points_first', 150),
			points_second: num('points_second', 100),
			points_third: num('points_third', 60),
			status: str('status')
		};

		if (form.get('remove_cover') === '1') patch.cover_url = null;
		try {
			const uploaded = await uploadCover(form.get('cover'), 'hackathons');
			if (uploaded) patch.cover_url = uploaded;
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Cover upload failed' });
		}

		const { error: updateError } = await event.locals.supabase
			.from('hackathons')
			.update(patch)
			.eq('id', event.params.id);
		if (updateError) return fail(400, { error: updateError.message });
		return { success: 'Hackathon saved.' };
	},

	remove: async (event) => {
		await requireContentManager(event);
		const { error: deleteError } = await event.locals.supabase
			.from('hackathons')
			.delete()
			.eq('id', event.params.id);
		if (deleteError) return fail(400, { error: deleteError.message });
		throw redirect(303, '/admin/hackathons');
	},

	decide: async (event) => {
		const admin = await requireStaff(event);
		const form = await event.request.formData();
		const ids = form.getAll('ids').map(String).filter(Boolean);
		const single = String(form.get('id') ?? '');
		const targets = ids.length ? ids : single ? [single] : [];
		const status = String(form.get('status') ?? '');

		if (!targets.length) return fail(400, { error: 'Select at least one application.' });
		if (!['accepted', 'rejected', 'pending'].includes(status)) {
			return fail(400, { error: 'Invalid decision' });
		}

		const sb = event.locals.supabase;
		const { data, error: updateError } = await sb
			.from('hackathon_applications')
			.update({ status, decided_at: new Date().toISOString(), decided_by: admin.id })
			.in('id', targets)
			.eq('hackathon_id', event.params.id)
			.select('member_id,profiles:member_id(full_name,email)');

		if (updateError) return fail(400, { error: updateError.message });

		if (status !== 'pending') {
			const { data: h } = await sb
				.from('hackathons')
				.select('title,slug')
				.eq('id', event.params.id)
				.maybeSingle();
			if (h) {
				await mailDecision(
					status as 'accepted' | 'rejected',
					(data ?? []).map((r: any) => r.profiles),
					h.title,
					h.slug,
					event.url.origin,
					await loadTheme(sb)
				);
			}
		}

		return { success: `${data?.length ?? 0} application(s) marked ${status}.` };
	},

	bulkAcceptPending: async (event) => {
		const admin = await requireStaff(event);
		const sb = event.locals.supabase;

		const { data, error: updateError } = await sb
			.from('hackathon_applications')
			.update({ status: 'accepted', decided_at: new Date().toISOString(), decided_by: admin.id })
			.eq('hackathon_id', event.params.id)
			.eq('status', 'pending')
			.select('profiles:member_id(full_name,email)');

		if (updateError) return fail(400, { error: updateError.message });

		const { data: h } = await sb
			.from('hackathons')
			.select('title,slug')
			.eq('id', event.params.id)
			.maybeSingle();
		if (h) {
			await mailDecision(
				'accepted',
				(data ?? []).map((r: any) => r.profiles),
				h.title,
				h.slug,
				event.url.origin,
				await loadTheme(sb)
			);
		}

		return { success: `Accepted ${data?.length ?? 0} pending application(s).` };
	},

	setWinner: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const memberId = String(form.get('member_id') ?? '');
		const place = Number(form.get('place'));
		const teamName = String(form.get('team_name') ?? '').trim() || null;

		if (!memberId) return fail(400, { error: 'Pick a participant.' });
		if (![1, 2, 3].includes(place)) return fail(400, { error: 'Place must be 1, 2 or 3.' });

		// upsert on (hackathon_id, member_id); the DB trigger awards the points
		// and unlocks the winner certificate.
		const { error: upsertError } = await event.locals.supabase
			.from('hackathon_winners')
			.upsert(
				{ hackathon_id: event.params.id, member_id: memberId, place, team_name: teamName },
				{ onConflict: 'hackathon_id,member_id' }
			);

		if (upsertError) return fail(400, { error: upsertError.message });
		return { success: `Winner saved, certificate unlocked.` };
	},

	removeWinner: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const memberId = String(form.get('member_id') ?? '');
		const admin = supabaseAdmin();

		const { error: deleteError } = await event.locals.supabase
			.from('hackathon_winners')
			.delete()
			.eq('hackathon_id', event.params.id)
			.eq('member_id', memberId);
		if (deleteError) return fail(400, { error: deleteError.message });

		await admin
			.from('points_ledger')
			.delete()
			.eq('member_id', memberId)
			.eq('source', 'hackathon_winner')
			.eq('source_id', event.params.id);
		await admin
			.from('certificates')
			.delete()
			.eq('member_id', memberId)
			.eq('hackathon_id', event.params.id)
			.eq('kind', 'winner');

		return { success: 'Winner removed (points and winner certificate revoked).' };
	}
};
