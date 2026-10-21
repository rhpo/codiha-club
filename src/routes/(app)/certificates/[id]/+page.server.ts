import { error } from '@sveltejs/kit';
import { certificateRoleTitle } from '$lib/roles.js';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public by unguessable UUID so a member can forward the link to a recruiter.
 * Revoked certificates stop resolving.
 */
export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (!UUID.test(params.id)) throw error(404, 'Certificate not found');

	// verify_certificate() is SECURITY DEFINER: this works for a signed-out
	// visitor without exposing the certificates table.
	const { data } = await locals.supabase.rpc('verify_certificate', { p_id: params.id });
	const row = Array.isArray(data) ? data[0] : data;
	if (!row) throw error(404, 'Certificate not found');
	if (row.revoked) throw error(410, 'This certificate has been revoked');

	// A membership certificate has no event or hackathon behind it, so the
	// role takes the place of the context title.
	return {
		certificate: {
			id: row.id,
			code: row.code,
			kind: row.kind,
			place: row.place,
			memberName: row.member_name,
			memberUniversity: row.member_university,
			contextTitle:
				row.kind === 'membership'
					? certificateRoleTitle(row.role)
					: (row.context_title ?? row.title),
			contextDate: row.context_date,
			issuedAt: row.issued_at,
			role: row.role,
			periodStart: row.period_start,
			periodEnd: row.period_end,
			verifyUrl: `${url.origin}/verify/${row.id}`
		}
	};
};
