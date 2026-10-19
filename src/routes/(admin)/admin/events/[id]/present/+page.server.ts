import { error } from '@sveltejs/kit';
import { requireContentManager } from '$lib/server/guards';
import { isCheckinWindowOpen, issueCheckinToken, windowSeconds } from '$lib/server/checkin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireContentManager(event);

	const { data: clubEvent } = await event.locals.supabase
		.from('events')
		.select('id,slug,title,starts_at,ends_at,status,checkin_points')
		.eq('id', event.params.id)
		.maybeSingle();

	if (!clubEvent) throw error(404, 'Event not found');

	const open = clubEvent.status !== 'cancelled' && isCheckinWindowOpen(clubEvent.starts_at, clubEvent.ends_at);
	const issued = open ? issueCheckinToken(clubEvent.id) : null;

	const [{ count: attendance }, { count: registered }] = await Promise.all([
		event.locals.supabase
			.from('event_attendance')
			.select('id', { count: 'exact', head: true })
			.eq('event_id', clubEvent.id),
		event.locals.supabase
			.from('event_registrations')
			.select('id', { count: 'exact', head: true })
			.eq('event_id', clubEvent.id)
			.eq('status', 'registered')
	]);

	return {
		event: clubEvent,
		open,
		initialUrl: issued ? `${event.url.origin}/checkin/${issued.token}` : null,
		windowSeconds: windowSeconds(),
		expiresInMs: issued?.expiresInMs ?? 0,
		attendance: attendance ?? 0,
		registered: registered ?? 0
	};
};
