import { requireMember } from '$lib/server/guards';
import { isCheckinWindowOpen, verifyCheckinToken } from '$lib/server/checkin';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { PageServerLoad } from './$types';

type Outcome =
	| 'checked_in'
	| 'already'
	| 'expired'
	| 'invalid'
	| 'closed'
	| 'not_found'
	| 'error';

/**
 * Scanning the rotating QR lands here. The token is HMAC-verified server-side,
 * then attendance is written with the service-role client (RLS forbids members
 * from inserting attendance themselves). The unique (event_id, member_id)
 * index makes the points award happen exactly once per event.
 */
export const load: PageServerLoad = async (event) => {
	const profile = await requireMember(event);
	const admin = supabaseAdmin();

	let outcome: Outcome = 'error';
	let clubEvent: any = null;
	let points = 0;
	let detail: string | null = null;

	const verdict = await verifyCheckinToken(event.params.token);

	if (!verdict.ok) {
		outcome = verdict.reason === 'expired' ? 'expired' : 'invalid';
	} else {
		const { data: ev } = await admin
			.from('events')
			.select('id,slug,title,starts_at,ends_at,checkin_points,status')
			.eq('id', verdict.eventId)
			.maybeSingle();

		clubEvent = ev;

		if (!ev) {
			outcome = 'not_found';
		} else if (ev.status === 'cancelled') {
			outcome = 'closed';
			detail = 'This event was cancelled.';
		} else if (!isCheckinWindowOpen(ev.starts_at, ev.ends_at)) {
			outcome = 'closed';
			detail = 'Check-in is only open around the event time.';
		} else {
			const { data: existing } = await admin
				.from('event_attendance')
				.select('checked_in_at')
				.eq('event_id', ev.id)
				.eq('member_id', profile.id)
				.maybeSingle();

			if (existing) {
				outcome = 'already';
				detail = existing.checked_in_at;
				points = ev.checkin_points;
			} else {
				const { error } = await admin
					.from('event_attendance')
					.insert({ event_id: ev.id, member_id: profile.id });

				if (error) {
					// racing scans hit the unique index, so treat as already checked in
					outcome = error.code === '23505' ? 'already' : 'error';
					detail = outcome === 'error' ? error.message : null;
					points = ev.checkin_points;
				} else {
					outcome = 'checked_in';
					points = ev.checkin_points;

					// make sure they are counted as registered too
					await admin
						.from('event_registrations')
						.upsert(
							{ event_id: ev.id, member_id: profile.id, status: 'registered' },
							{ onConflict: 'event_id,member_id', ignoreDuplicates: true }
						);
				}
			}
		}
	}

	const { data: totals } = await event.locals.supabase
		.from('my_points')
		.select('semester_points')
		.eq('member_id', profile.id)
		.maybeSingle();

	return {
		outcome,
		detail,
		points,
		event: clubEvent
			? { slug: clubEvent.slug, title: clubEvent.title, starts_at: clubEvent.starts_at }
			: null,
		semesterPoints: totals?.semester_points ?? 0
	};
};
