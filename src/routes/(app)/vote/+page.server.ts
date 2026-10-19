import { fail } from '@sveltejs/kit';
import { requireMember } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const profile = await requireMember(event);
	const sb = event.locals.supabase;

	const [polls, ballots] = await Promise.all([
		sb
			.from('polls')
			// option labels already carry the member's name, so no profiles join
			.select('*,poll_options(id,label,position,member_id)')
			.eq('status', 'published')
			.order('closes_at', { ascending: true }),
		sb.from('poll_ballots').select('poll_id,voted_at').eq('voter_id', profile.id)
	]);

	const voted = new Map(
		(ballots.data ?? []).map((b: { poll_id: string; voted_at: string }) => [b.poll_id, b.voted_at])
	);
	const now = Date.now();

	const enriched = await Promise.all(
		(polls.data ?? []).map(async (poll: any) => {
			const closed = new Date(poll.closes_at).getTime() < now;
			const notOpenYet = new Date(poll.opens_at).getTime() > now;
			let results: { option_id: string; label: string; votes: number }[] | null = null;

			if (closed && poll.results_public) {
				const { data } = await sb.rpc('poll_results', { p_poll: poll.id });
				results = data ?? [];
			}

			return {
				...poll,
				poll_options: [...(poll.poll_options ?? [])].sort((a, b) => a.position - b.position),
				closed,
				notOpenYet,
				votedAt: voted.get(poll.id) ?? null,
				results
			};
		})
	);

	return {
		open: enriched.filter((p) => !p.closed && !p.notOpenYet),
		upcoming: enriched.filter((p) => p.notOpenYet),
		closed: enriched.filter((p) => p.closed)
	};
};

export const actions: Actions = {
	vote: async (event) => {
		await requireMember(event);
		const form = await event.request.formData();
		const pollId = String(form.get('poll_id') ?? '');
		const optionId = String(form.get('option_id') ?? '');

		if (!pollId || !optionId) return fail(400, { error: 'Pick an option first.' });

		const { error } = await event.locals.supabase.rpc('cast_vote', {
			p_poll: pollId,
			p_option: optionId
		});

		if (error) return fail(400, { error: error.message });
		return { success: 'Vote recorded. Your ballot stays anonymous.' };
	}
};
