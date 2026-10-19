import { fail, redirect } from '@sveltejs/kit';
import { requireContentManager } from '$lib/server/guards';
import { localToUtcIso, tzOffsetFrom } from '$lib/server/datetime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireContentManager(event);
	const sb = event.locals.supabase;

	const [polls, ballots, members] = await Promise.all([
		sb
			.from('polls')
			.select('*,poll_options(id)')
			.order('created_at', { ascending: false }),
		sb.from('poll_ballots').select('poll_id'),
		sb
			.from('profiles')
			.select('id,full_name,university')
			.eq('status', 'approved')
			.order('full_name', { ascending: true })
	]);

	const ballotCount: Record<string, number> = {};
	for (const b of ballots.data ?? []) ballotCount[b.poll_id] = (ballotCount[b.poll_id] ?? 0) + 1;

	return {
		polls: polls.data ?? [],
		ballotCount,
		members: members.data ?? [],
		memberCount: members.data?.length ?? 0
	};
};

export const actions: Actions = {
	create: async (event) => {
		const admin = await requireContentManager(event);
		const form = await event.request.formData();
		const tz = tzOffsetFrom(form);
		const str = (k: string) => String(form.get(k) ?? '').trim();

		const title = str('title');
		const opens_at = localToUtcIso(form.get('opens_at'), tz) ?? new Date().toISOString();
		const closes_at = localToUtcIso(form.get('closes_at'), tz);

		if (!title) return fail(400, { error: 'Title is required.' });
		if (!closes_at) return fail(400, { error: 'A closing date is required.' });
		if (new Date(closes_at) <= new Date(opens_at)) {
			return fail(400, { error: 'The poll must close after it opens.' });
		}

		const textOptions = str('options')
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
		const memberOptions = form.getAll('member_options').map(String).filter(Boolean);

		if (!textOptions.length && !memberOptions.length) {
			return fail(400, { error: 'Add at least two options.' });
		}
		if (textOptions.length + memberOptions.length < 2) {
			return fail(400, { error: 'A poll needs at least two options.' });
		}

		const sb = event.locals.supabase;
		const { data: poll, error: insertError } = await sb
			.from('polls')
			.insert({
				title,
				description: str('description') || null,
				opens_at,
				closes_at,
				results_public: form.get('results_public') === '1',
				status: str('status') || 'draft',
				created_by: admin.id
			})
			.select('id')
			.maybeSingle();

		if (insertError || !poll) return fail(400, { error: insertError?.message ?? 'Could not create poll' });

		const members = (await sb.from('profiles').select('id,full_name').in('id', memberOptions)).data ?? [];
		const rows = [
			...textOptions.map((label, i) => ({ poll_id: poll.id, label, position: i })),
			...members.map((m, i) => ({
				poll_id: poll.id,
				label: m.full_name || 'Member',
				member_id: m.id,
				position: textOptions.length + i
			}))
		];

		const { error: optionsError } = await sb.from('poll_options').insert(rows);
		if (optionsError) return fail(400, { error: optionsError.message });

		throw redirect(303, `/admin/polls/${poll.id}`);
	}
};
