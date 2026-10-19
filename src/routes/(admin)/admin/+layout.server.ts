import { requireStaff } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const profile = await requireStaff(event);
	const sb = event.locals.supabase;

	const [pending, pendingApps] = await Promise.all([
		sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
		sb
			.from('hackathon_applications')
			.select('id', { count: 'exact', head: true })
			.eq('status', 'pending')
	]);

	return {
		profile,
		pendingMembers: pending.count ?? 0,
		pendingApplications: pendingApps.count ?? 0
	};
};
