import { fail, redirect } from '@sveltejs/kit';
import { requireContentManager } from '$lib/server/guards';
import { localToUtcIso, tzOffsetFrom } from '$lib/server/datetime';
import { uploadCover } from '$lib/server/upload';
import { slugify } from '$lib/utils.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireContentManager(event);
	const sb = event.locals.supabase;

	const [events, regs, atts] = await Promise.all([
		sb.from('events').select('*').order('starts_at', { ascending: false }),
		sb.from('event_registrations').select('event_id,status'),
		sb.from('event_attendance').select('event_id')
	]);

	const regCount: Record<string, number> = {};
	for (const r of regs.data ?? []) {
		if (r.status === 'cancelled') continue;
		regCount[r.event_id] = (regCount[r.event_id] ?? 0) + 1;
	}
	const attCount: Record<string, number> = {};
	for (const a of atts.data ?? []) attCount[a.event_id] = (attCount[a.event_id] ?? 0) + 1;

	return { events: events.data ?? [], regCount, attCount };
};

export const actions: Actions = {
	create: async (event) => {
		const admin = await requireContentManager(event);
		const form = await event.request.formData();
		const tz = tzOffsetFrom(form);
		const str = (k: string) => String(form.get(k) ?? '').trim();

		const title = str('title');
		const starts_at = localToUtcIso(form.get('starts_at'), tz);
		const ends_at = localToUtcIso(form.get('ends_at'), tz);

		if (!title) return fail(400, { error: 'Title is required.' });
		if (!starts_at || !ends_at) return fail(400, { error: 'Start and end dates are required.' });
		if (new Date(ends_at) <= new Date(starts_at)) {
			return fail(400, { error: 'The end date must be after the start date.' });
		}

		let cover_url: string | null = null;
		try {
			cover_url = await uploadCover(form.get('cover'), 'events');
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Cover upload failed' });
		}

		const capacity = str('capacity');
		const { data, error } = await event.locals.supabase
			.from('events')
			.insert({
				title,
				slug: str('slug') || slugify(title) || `event-${Date.now()}`,
				summary: str('summary') || null,
				description: str('description') || null,
				location: str('location') || null,
				capacity: capacity ? Number(capacity) : null,
				checkin_points: Number(str('checkin_points') || 10),
				status: str('status') || 'draft',
				starts_at,
				ends_at,
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

		throw redirect(303, `/admin/events/${data!.id}`);
	}
};
