import { error, json } from '@sveltejs/kit';
import { requireAdminApi } from '$lib/server/guards';
import { issueCheckinToken, isCheckinWindowOpen } from '$lib/server/checkin';
import type { RequestHandler } from './$types';

/** Polled by the event presentation screen every rotation window. */
export const GET: RequestHandler = async (event) => {
	await requireAdminApi(event);

	const eventId = event.url.searchParams.get('event');
	if (!eventId) throw error(400, 'Missing ?event=');

	const { data: ev } = await event.locals.supabase
		.from('events')
		.select('id,title,starts_at,ends_at,status')
		.eq('id', eventId)
		.maybeSingle();

	if (!ev) throw error(404, 'Event not found');

	const open = ev.status !== 'cancelled' && isCheckinWindowOpen(ev.starts_at, ev.ends_at);
	const { token, windowSeconds, expiresInMs } = await issueCheckinToken(ev.id);

	const [{ count: attendance }, { count: registered }] = await Promise.all([
		event.locals.supabase
			.from('event_attendance')
			.select('id', { count: 'exact', head: true })
			.eq('event_id', ev.id),
		event.locals.supabase
			.from('event_registrations')
			.select('id', { count: 'exact', head: true })
			.eq('event_id', ev.id)
			.eq('status', 'registered')
	]);

	return json({
		open,
		url: open ? `${event.url.origin}/checkin/${token}` : null,
		windowSeconds,
		expiresInMs,
		attendance: attendance ?? 0,
		registered: registered ?? 0
	});
};
