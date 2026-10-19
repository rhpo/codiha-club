import { can } from '$lib/roles.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sb = locals.supabase;
	const abilities = can(await locals.getProfile());
	const now = new Date().toISOString();

	const [members, pending, events, upcoming, hackathons, pendingApps, ledger, certs, polls] =
		await Promise.all([
			sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
			sb
				.from('profiles')
				.select('id,full_name,email,university,field,year,created_at,avatar_url')
				.eq('status', 'pending')
				.not('onboarded_at', 'is', null)
				.order('created_at', { ascending: true })
				.limit(6),
			sb.from('events').select('id', { count: 'exact', head: true }),
			sb
				.from('events')
				.select('id,slug,title,starts_at,ends_at,status')
				.gte('ends_at', now)
				.order('starts_at', { ascending: true })
				.limit(5),
			sb.from('hackathons').select('id', { count: 'exact', head: true }),
			sb
				.from('hackathon_applications')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'pending'),
			sb
				.from('points_ledger')
				.select('id,amount,reason,created_at,profiles:member_id(full_name)')
				.order('created_at', { ascending: false })
				.limit(10),
			sb.from('certificates').select('id', { count: 'exact', head: true }),
			sb
				.from('polls')
				.select('id,title,closes_at,status')
				.eq('status', 'published')
				.gte('closes_at', now)
		]);

	// Admins watch the send quota without being able to read the messages;
	// mail_quota_report() is SECURITY DEFINER and checks is_admin() itself.
	const quotas = abilities.manageUsers
		? (await sb.rpc('mail_quota_report')).data ?? []
		: [];

	return {
		abilities,
		quotas,
		counts: {
			members: members.count ?? 0,
			pendingMembers: pending.data?.length ?? 0,
			events: events.count ?? 0,
			hackathons: hackathons.count ?? 0,
			pendingApplications: pendingApps.count ?? 0,
			certificates: certs.count ?? 0
		},
		pending: pending.data ?? [],
		upcoming: upcoming.data ?? [],
		recentLedger: ledger.data ?? [],
		openPolls: polls.data ?? []
	};
};
