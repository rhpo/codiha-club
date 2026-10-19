import { safe } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sb = locals.supabase;
	const now = new Date().toISOString();
	const profile = await locals.getProfile();

	const [upcoming, past, myRegs] = await Promise.all([
		safe(
			sb
				.from('events')
				.select('*')
				.eq('status', 'published')
				.gte('ends_at', now)
				.order('starts_at', { ascending: true })
		),
		safe(
			sb
				.from('events')
				.select('*')
				.in('status', ['published', 'archived'])
				.lt('ends_at', now)
				.order('starts_at', { ascending: false })
				.limit(24)
		),
		profile
			? safe(sb.from('event_registrations').select('event_id,status').eq('member_id', profile.id))
			: Promise.resolve({ data: [] as { event_id: string; status: string }[] })
	]);

	const registered = new Set(
		(myRegs.data ?? [])
			.filter((r: { status: string }) => r.status !== 'cancelled')
			.map((r: { event_id: string }) => r.event_id)
	);

	return {
		upcoming: upcoming.data ?? [],
		past: past.data ?? [],
		registeredIds: [...registered]
	};
};
