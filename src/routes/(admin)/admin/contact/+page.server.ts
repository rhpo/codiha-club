import { fail } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

/**
 * What the public wrote to the club.
 *
 * Staff and above, which is everybody who is not a plain member: the same
 * rank that reviews applications. The RLS policy says the same thing, so this
 * guard is the message rather than the defence.
 */
export const load: PageServerLoad = async (event) => {
	await requireStaff(event);

	const { data: messages } = await event.locals.supabase
		.from('contact_messages')
		.select('*,handler:handled_by(full_name)')
		.order('created_at', { ascending: false })
		.limit(200);

	return { messages: messages ?? [] };
};

const setStatus = async (event: Parameters<Actions[string]>[0], status: string) => {
	const profile = await requireStaff(event);
	const form = await event.request.formData();
	const id = String(form.get('id') ?? '');
	if (!id) return fail(400, { error: 'Missing message' });

	// Who dealt with it, so two people do not answer the same message. Going
	// back to unread clears that rather than leaving a stale name on it.
	const handled = status === 'handled';
	const { error } = await event.locals.supabase
		.from('contact_messages')
		.update({
			status,
			handled_by: handled ? profile.id : null,
			handled_at: handled ? new Date().toISOString() : null
		})
		.eq('id', id);

	if (error) return fail(400, { error: error.message });
	return { success: `Marked as ${status}.` };
};

export const actions: Actions = {
	read: (event) => setStatus(event, 'read'),
	handled: (event) => setStatus(event, 'handled'),
	reopen: (event) => setStatus(event, 'new')
};
