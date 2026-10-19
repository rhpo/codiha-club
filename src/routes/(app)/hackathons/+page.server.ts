import { safe } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sb = locals.supabase;
	const now = new Date().toISOString();
	const profile = await locals.getProfile();

	const [current, past, myApps] = await Promise.all([
		safe(
			sb
				.from('hackathons')
				.select('*')
				.in('status', ['published', 'closed'])
				.gte('ends_at', now)
				.order('starts_at', { ascending: true })
		),
		safe(
			sb
				.from('hackathons')
				.select('*')
				.in('status', ['published', 'closed', 'archived'])
				.lt('ends_at', now)
				.order('starts_at', { ascending: false })
				.limit(12)
		),
		profile
			? safe(
					sb
						.from('hackathon_applications')
						.select('hackathon_id,status')
						.eq('member_id', profile.id)
				)
			: Promise.resolve({ data: [] as { hackathon_id: string; status: string }[] })
	]);

	const applied: Record<string, string> = {};
	for (const a of myApps.data ?? []) applied[a.hackathon_id] = a.status;

	return { current: current.data ?? [], past: past.data ?? [], applied };
};
