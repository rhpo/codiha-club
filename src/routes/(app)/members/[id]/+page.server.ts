import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A member's public page.
 *
 * Deliberately built on the `members` view rather than `profiles`: the view
 * is already the club's answer to "what is safe to show a stranger" - it
 * carries no email, phone or Discord handle, and only approved members. A
 * page that selected from profiles would have to re-make that decision, and
 * would get it wrong the first time somebody added a column.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!UUID.test(params.id)) throw error(404, 'Member not found');
	const sb = locals.supabase;

	const { data: member } = await sb
		.from('members')
		.select('id,full_name,university,field,year,avatar_url,bio,github,linkedin,created_at')
		.eq('id', params.id)
		.maybeSingle();

	if (!member) throw error(404, 'Member not found');

	// Points and posts are public the same way the leaderboard is. Posts are
	// only fetched for signed-in members, because the feed itself is.
	const viewer = await locals.getProfile();
	const isMember = viewer?.status === 'approved';

	const [{ data: rank }, { data: badges }, posts] = await Promise.all([
		sb.from('leaderboard').select('rank,points').eq('id', params.id).maybeSingle(),
		sb
			.from('member_badges')
			.select('awarded_at,badges(slug,name,description,icon,color)')
			.eq('member_id', params.id)
			.order('awarded_at', { ascending: false }),
		isMember
			? sb
					.from('post_feed')
					.select('*')
					.eq('author_id', params.id)
					.order('created_at', { ascending: false })
					.limit(10)
			: Promise.resolve({ data: [] })
	]);

	return {
		member,
		rank: rank?.rank ?? null,
		points: rank?.points ?? 0,
		badges: (badges ?? []).map((b: Record<string, unknown>) => ({
			...(b.badges as Record<string, unknown>),
			awarded_at: b.awarded_at
		})),
		posts: posts.data ?? [],
		isMember,
		isMe: viewer?.id === params.id
	};
};
