import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The gallery used to be a hardcoded article at this URL. It is a real page
 * backed by the database now, but links to the old address are already out
 * there, so they are forwarded rather than 404ing.
 */
export const load: PageServerLoad = () => {
	throw redirect(308, '/gallery');
};
