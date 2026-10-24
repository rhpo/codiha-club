import { groupGallery } from '$lib/gallery.js';
import type { PageServerLoad } from './$types';

/**
 * Public on purpose: the gallery is the club's shop window, and the RLS
 * policy lets anyone read it.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const { data } = await locals.supabase
		.from('gallery_items')
		.select('id,url,caption,section,position,kind')
		.order('position');

	return { sections: groupGallery(data ?? []) };
};
