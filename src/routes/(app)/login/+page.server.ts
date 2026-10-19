import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const PROVIDERS = ['google', 'discord'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await locals.getUser();

	// Already signed in? Never show the sign-in page again. A session with no
	// profile row goes to /onboarding, which creates one, instead of sitting
	// here offering a sign-in the member has already completed.
	if (user) {
		const profile = await locals.getProfile();
		if (!profile?.onboarded_at) throw redirect(303, '/onboarding');
		if (profile.status !== 'approved') throw redirect(303, '/pending');
		const next = url.searchParams.get('next');
		throw redirect(303, next?.startsWith('/') ? next : '/dashboard');
	}

	return { error: url.searchParams.get('error') };
};

export const actions: Actions = {
	oauth: async ({ request, locals, url }) => {
		const form = await request.formData();
		const provider = String(form.get('provider') ?? '');
		const next = String(form.get('next') ?? '/dashboard');

		if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
			return fail(400, { error: 'Unsupported sign-in provider' });
		}

		const redirectTo = `${url.origin}/auth/callback?next=${encodeURIComponent(
			next.startsWith('/') ? next : '/dashboard'
		)}`;

		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider: provider as (typeof PROVIDERS)[number],
			options: { redirectTo, skipBrowserRedirect: true }
		});

		if (error || !data?.url) {
			return fail(400, { error: error?.message ?? 'Could not start sign-in' });
		}

		throw redirect(303, data.url);
	}
};
