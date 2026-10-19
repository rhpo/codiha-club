import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) throw redirect(303, '/login');

	// Signed in but no profile row yet: send them to onboarding, which upserts
	// one. Bouncing to /login instead just showed a sign-in page to somebody who
	// was already signed in.
	const profile = await locals.getProfile();
	if (!profile || !profile.onboarded_at) throw redirect(303, '/onboarding');
	if (profile.status === 'approved') throw redirect(303, '/dashboard');
	return { profile };
};
