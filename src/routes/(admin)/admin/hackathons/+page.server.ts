import { fail, redirect } from '@sveltejs/kit';
import { requireContentManager } from '$lib/server/guards';
import { localToUtcIso, tzOffsetFrom } from '$lib/server/datetime';
import { uploadCover } from '$lib/server/upload';
import { slugify } from '$lib/utils.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireContentManager(event);
	const sb = event.locals.supabase;

	const [hackathons, apps] = await Promise.all([
		sb.from('hackathons').select('*').order('starts_at', { ascending: false }),
		sb.from('hackathon_applications').select('hackathon_id,status')
	]);

	const counts: Record<string, { pending: number; accepted: number; total: number }> = {};
	for (const a of apps.data ?? []) {
		const c = (counts[a.hackathon_id] ??= { pending: 0, accepted: 0, total: 0 });
		c.total++;
		if (a.status === 'pending') c.pending++;
		if (a.status === 'accepted') c.accepted++;
	}

	return { hackathons: hackathons.data ?? [], counts };
};

export const actions: Actions = {
	create: async (event) => {
		const admin = await requireContentManager(event);
		const form = await event.request.formData();
		const tz = tzOffsetFrom(form);
		const str = (k: string) => String(form.get(k) ?? '').trim();
		const num = (k: string, fallback: number) => {
			const n = Number(str(k));
			return Number.isFinite(n) ? n : fallback;
		};

		const title = str('title');
		const starts_at = localToUtcIso(form.get('starts_at'), tz);
		const ends_at = localToUtcIso(form.get('ends_at'), tz);

		if (!title) return fail(400, { error: 'Title is required.' });
		if (!starts_at || !ends_at) return fail(400, { error: 'Start and end dates are required.' });
		if (new Date(ends_at) <= new Date(starts_at)) {
			return fail(400, { error: 'The end date must be after the start date.' });
		}
		if (num('team_size_max', 4) < num('team_size_min', 1)) {
			return fail(400, { error: 'Max team size must be >= min team size.' });
		}

		let cover_url: string | null = null;
		try {
			cover_url = await uploadCover(form.get('cover'), 'hackathons');
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Cover upload failed' });
		}

		const { data, error } = await event.locals.supabase
			.from('hackathons')
			.insert({
				title,
				slug: str('slug') || slugify(title) || `hackathon-${Date.now()}`,
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
				status: str('status') || 'draft',
				cover_url,
				created_by: admin.id
			})
			.select('id')
			.maybeSingle();

		if (error) {
			return fail(400, {
				error: error.code === '23505' ? 'That slug is already taken.' : error.message
			});
		}

		throw redirect(303, `/admin/hackathons/${data!.id}`);
	}
};
