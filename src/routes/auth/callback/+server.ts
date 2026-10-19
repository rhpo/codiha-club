import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** OAuth lands here. Exchange the code for a cookie session, then route by state. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/dashboard';
	const errorDescription = url.searchParams.get('error_description');

	if (errorDescription) {
		throw redirect(303, `/login?error=${encodeURIComponent(errorDescription)}`);
	}
	if (!code) {
		throw redirect(303, '/login?error=Missing%20authorization%20code');
	}

	const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
	if (error) {
		throw redirect(303, `/login?error=${encodeURIComponent(error.message)}`);
	}

	const { data: userData } = await locals.supabase.auth.getUser();
	const userId = userData.user?.id;
	if (!userId) throw redirect(303, '/login?error=Sign-in%20did%20not%20return%20a%20user');

	const profile = await locals.supabase
		.from('profiles')
		.select('onboarded_at,status')
		.eq('id', userId)
		.maybeSingle();

	// No row means on_auth_user_created never ran for this account. /onboarding
	// upserts one, so routing there heals it rather than dead-ending.
	if (!profile.data?.onboarded_at) throw redirect(303, '/onboarding');
	if (profile.data.status !== 'approved') throw redirect(303, '/pending');

	// never bounce an external URL back to the browser
	throw redirect(303, next.startsWith('/') ? next : '/dashboard');
};
