import { safe } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const now = new Date().toISOString();
	const sb = locals.supabase;

	// The feed is members-only by RLS, so a signed-out visitor simply gets
	// nothing back and the section hides itself. No extra check needed here.
	const [leaderboard, events, hackathons, semester, directory, posts] = await Promise.all([
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
		),
		safe(sb.from('post_feed').select('*').order('created_at', { ascending: false }).limit(3))
	]);

	// One query for every image rather than one per post.
	const postRows = posts.data ?? [];
	const ids = postRows.map((p: { id: string }) => p.id);
	const { data: images } = ids.length
		? await safe(sb.from('post_images').select('post_id,url').in('post_id', ids).order('position'))
		: { data: [] };

	const imagesBy = new Map<string, string[]>();
	for (const img of images ?? []) {
		const list = imagesBy.get(img.post_id) ?? [];
		list.push(img.url);
		imagesBy.set(img.post_id, list);
	}

	// No CDN caching: the shared nav renders the signed-in member's name.
	return {
		leaderboard: leaderboard.data ?? [],
		events: events.data ?? [],
		hackathons: hackathons.data ?? [],
		semester: semester.data ?? null,
		members: directory.data ?? [],
		posts: postRows.map((p: { id: string }) => ({
			...p,
			images: imagesBy.get(p.id) ?? []
		}))
	};
};
