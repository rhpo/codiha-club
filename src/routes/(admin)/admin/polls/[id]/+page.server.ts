import { error, fail, redirect } from '@sveltejs/kit';
import { requireContentManager } from '$lib/server/guards';
import { localToUtcIso, tzOffsetFrom } from '$lib/server/datetime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireContentManager(event);
	const sb = event.locals.supabase;

	const { data: poll } = await sb.from('polls').select('*').eq('id', event.params.id).maybeSingle();
	if (!poll) throw error(404, 'Poll not found');

	const [options, results, ballots, eligible] = await Promise.all([
		sb
			.from('poll_options')
			.select('*,profiles:member_id(full_name,avatar_url)')
			.eq('poll_id', poll.id)
			.order('position', { ascending: true }),
		// poll_results() is readable by admins at any time
		sb.rpc('poll_results', { p_poll: poll.id }),
		sb.from('poll_ballots').select('poll_id', { count: 'exact', head: true }).eq('poll_id', poll.id),
		sb.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved')
	]);

	return {
		poll,
		options: options.data ?? [],
		results: results.data ?? [],
		ballots: ballots.count ?? 0,
		eligible: eligible.count ?? 0
	};
};

export const actions: Actions = {
	update: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const tz = tzOffsetFrom(form);
		const str = (k: string) => String(form.get(k) ?? '').trim();

		const closes_at = localToUtcIso(form.get('closes_at'), tz);
		const opens_at = localToUtcIso(form.get('opens_at'), tz);
		if (!closes_at || !opens_at) return fail(400, { error: 'Both dates are required.' });
		if (new Date(closes_at) <= new Date(opens_at)) {
			return fail(400, { error: 'The poll must close after it opens.' });
		}

		const { error: updateError } = await event.locals.supabase
			.from('polls')
			.update({
				title: str('title'),
				description: str('description') || null,
				opens_at,
				closes_at,
				status: str('status'),
				results_public: form.get('results_public') === '1'
			})
			.eq('id', event.params.id);

		if (updateError) return fail(400, { error: updateError.message });
		return { success: 'Vote saved.' };
	},

	closeNow: async (event) => {
		await requireContentManager(event);
		const { error: updateError } = await event.locals.supabase
			.from('polls')
			.update({ closes_at: new Date().toISOString() })
			.eq('id', event.params.id);
		if (updateError) return fail(400, { error: updateError.message });
		return { success: 'Voting closed. Results are now visible to members.' };
	},

	addOption: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const label = String(form.get('label') ?? '').trim();
		if (!label) return fail(400, { error: 'Option label is required.' });

		const { count } = await event.locals.supabase
			.from('poll_options')
			.select('id', { count: 'exact', head: true })
			.eq('poll_id', event.params.id);

		const { error: insertError } = await event.locals.supabase
			.from('poll_options')
			.insert({ poll_id: event.params.id, label, position: count ?? 0 });

		if (insertError) return fail(400, { error: insertError.message });
		return { success: 'Option added.' };
	},

	removeOption: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const id = String(form.get('option_id') ?? '');

		const { error: deleteError } = await event.locals.supabase
			.from('poll_options')
			.delete()
			.eq('id', id)
			.eq('poll_id', event.params.id);

		if (deleteError) return fail(400, { error: deleteError.message });
		return { success: 'Option removed (its votes were removed too).' };
	},

	remove: async (event) => {
		await requireContentManager(event);
		const { error: deleteError } = await event.locals.supabase
			.from('polls')
			.delete()
			.eq('id', event.params.id);
		if (deleteError) return fail(400, { error: deleteError.message });
		throw redirect(303, '/admin/polls');
	}
};
