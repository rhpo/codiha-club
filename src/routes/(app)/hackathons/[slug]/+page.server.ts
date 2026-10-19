import { error, fail, redirect } from '@sveltejs/kit';
import { marked } from 'marked';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const sb = locals.supabase;
	const profile = await locals.getProfile();

	const { data: hackathon } = await sb
		.from('hackathons')
		.select('*')
		.eq('slug', params.slug)
		.maybeSingle();
	if (!hackathon) throw error(404, 'Hackathon not found');

	const [{ count: acceptedCount }, myApp, winners] = await Promise.all([
		sb
			.from('hackathon_applications')
			.select('id', { count: 'exact', head: true })
			.eq('hackathon_id', hackathon.id)
			.eq('status', 'accepted'),
		profile
			? sb
					.from('hackathon_applications')
					.select('*')
					.eq('hackathon_id', hackathon.id)
					.eq('member_id', profile.id)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		sb
			.from('hackathon_winners')
			.select('place,team_name,member_id')
			.eq('hackathon_id', hackathon.id)
			.order('place', { ascending: true })
	]);

	// Winner names come from the public `members` view. The profiles table
	// itself is not readable by other members (it holds emails and phones).
	const winnerRows = winners.data ?? [];
	let people: Record<string, { full_name: string; avatar_url: string | null; university: string | null }> = {};
	if (winnerRows.length) {
		const { data } = await sb
			.from('members')
			.select('id,full_name,avatar_url,university')
			.in('id', winnerRows.map((w) => w.member_id));
		for (const m of data ?? []) people[m.id] = m;
	}

	return {
		hackathon,
		descriptionHtml: hackathon.description ? await marked(hackathon.description) : null,
		acceptedCount: acceptedCount ?? 0,
		myApplication: myApp.data ?? null,
		winners: winnerRows.map((w) => ({ ...w, profiles: people[w.member_id] ?? null }))
	};
};

export const actions: Actions = {
	apply: async ({ params, request, locals, url }) => {
		const profile = await locals.getProfile();
		if (!profile) throw redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
		if (!profile.onboarded_at) throw redirect(303, '/onboarding');
		if (profile.status !== 'approved') throw redirect(303, '/pending');

		const sb = locals.supabase;
		const { data: hackathon } = await sb
			.from('hackathons')
			.select('id,status,apply_deadline,apply_opens_at')
			.eq('slug', params.slug)
			.maybeSingle();
		if (!hackathon) return fail(404, { error: 'Hackathon not found' });

		if (hackathon.status !== 'published') {
			return fail(400, { error: 'Applications are not open for this hackathon.' });
		}
		if (hackathon.apply_opens_at && new Date(hackathon.apply_opens_at).getTime() > Date.now()) {
			return fail(400, { error: 'Applications have not opened yet.' });
		}
		if (hackathon.apply_deadline && new Date(hackathon.apply_deadline).getTime() < Date.now()) {
			return fail(400, { error: 'The application deadline has passed.' });
		}

		const form = await request.formData();
		const str = (k: string) => String(form.get(k) ?? '').trim();
		const values = {
			team_name: str('team_name') || null,
			teammates: str('teammates') || null,
			motivation: str('motivation'),
			skills: str('skills') || null
		};

		if (values.motivation.length < 20) {
			return fail(400, { error: 'Tell us a bit more, at least a couple of sentences.', values });
		}

		const { error: insertError } = await sb.from('hackathon_applications').insert({
			hackathon_id: hackathon.id,
			member_id: profile.id,
			...values
		});

		if (insertError) {
			return fail(400, {
				error:
					insertError.code === '23505' || insertError.message.includes('duplicate')
						? 'You have already applied to this hackathon.'
						: insertError.message,
				values
			});
		}

		return { success: 'applied' };
	},

	withdraw: async ({ params, locals }) => {
		const profile = await locals.getProfile();
		if (!profile) throw redirect(303, '/login');

		const sb = locals.supabase;
		const { data: hackathon } = await sb
			.from('hackathons')
			.select('id')
			.eq('slug', params.slug)
			.maybeSingle();
		if (!hackathon) return fail(404, { error: 'Hackathon not found' });

		const { error: updateError } = await sb
			.from('hackathon_applications')
			.update({ status: 'withdrawn' })
			.eq('hackathon_id', hackathon.id)
			.eq('member_id', profile.id)
			.eq('status', 'pending');

		if (updateError) return fail(400, { error: updateError.message });
		return { success: 'withdrawn' };
	}
};
