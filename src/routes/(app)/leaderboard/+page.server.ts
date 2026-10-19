import { safe } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sb = locals.supabase;

	const [rows, semester, memberCount] = await Promise.all([
		safe(sb.from('leaderboard').select('*').order('rank', { ascending: true }).limit(200)),
		safe(sb.rpc('semester_bounds').maybeSingle()),
		// `members`, not `profiles`: profiles is readable only by its owner and by
		// admins, so counting it as an anonymous visitor would always return 0.
		safe(sb.from('members').select('id', { count: 'exact', head: true }))
	]);

	const list = rows.data ?? [];
	return {
		rows: list,
		semester: semester.data ?? null,
		memberCount: memberCount.count ?? list.length,
		totalPoints: list.reduce((sum: number, r: { points: number }) => sum + (r.points ?? 0), 0)
	};
};
