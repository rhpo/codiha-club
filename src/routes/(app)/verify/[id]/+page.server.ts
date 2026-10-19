import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!UUID.test(params.id)) return { certificate: null, id: params.id };

	// verify_certificate() is SECURITY DEFINER: anonymous visitors can check a
	// certificate without being able to read the certificates table.
	const { data } = await locals.supabase.rpc('verify_certificate', { p_id: params.id });
	const certificate = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);

	return { certificate, id: params.id };
};
