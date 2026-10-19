import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The old Google-Form redirect lives on as a permanent alias for /login. */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/login');
};
