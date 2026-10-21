import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Kept so links already forwarded to recruiters do not 404.
 *
 * The PDF is no longer built here. Each certificate design is a Svelte
 * component rendering SVG, and the PDF is produced from that same element in
 * the browser, so the download lives on the certificate page itself.
 */
export const GET: RequestHandler = ({ params }) => {
	throw redirect(308, `/certificates/${params.id}`);
};
