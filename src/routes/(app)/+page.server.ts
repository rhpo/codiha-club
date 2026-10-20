import { safe } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const now = new Date().toISOString();
	const sb = locals.supabase;

	const [leaderboard, events, hackathons, semester, directory] = await Promise.all([
		safe(sb.from('leaderboard').select('*').order('rank', { ascending: true }).limit(10)),
		safe(
			sb
				.from('events')
				.select(
					'id,slug,title,summary,cover_url,location,starts_at,ends_at,checkin_points,capacity'
				)
				.eq('status', 'published')
				.gte('ends_at', now)
				.order('starts_at', { ascending: true })
				.limit(3)
		),
		safe(
			sb
				.from('hackathons')
				.select('*')
				.eq('status', 'published')
				.gte('ends_at', now)
				.order('starts_at', { ascending: true })
				.limit(2)
		),
		safe(sb.rpc('semester_bounds').maybeSingle()),
		safe(
			sb
				.from('member_directory')
				.select('id,full_name,avatar_url,points,is_board')
				.order('points', { ascending: false })
				.limit(200)
		)
	]);

	// No CDN caching: the shared nav renders the signed-in member's name.
	return {
		leaderboard: leaderboard.data ?? [],
		events: events.data ?? [],
		hackathons: hackathons.data ?? [],
		semester: semester.data ?? null,
		members: directory.data ?? []
	};
};
