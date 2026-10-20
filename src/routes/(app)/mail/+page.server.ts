import { fail, type RequestEvent } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/guards';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { ensureAccount, quotaFor, sendFromMailbox, sendingAddressFor } from '$lib/server/mail';
import { can } from '$lib/roles.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * Resolves which mailbox the page is showing.
 *
 * A superadmin may pass ?as=<accountId> to open somebody else's inbox in the
 * same UI. Everyone else always gets their own, whatever the query string says.
 */
async function resolveAccount(
	event: RequestEvent,
	profile: { id: string; full_name: string; email: string | null; role: string; status: string }
) {
	const abilities = can(profile);
	const requested = event.url.searchParams.get('as');

	if (requested && abilities.readAnyMailbox) {
		const { data } = await supabaseAdmin()
			.from('mail_accounts')
			.select('id,address,label,member_id,daily_send_limit')
			.eq('id', requested)
			.maybeSingle();
		if (data) return { account: data, impersonating: data.member_id !== profile.id };
	}

	const own = await ensureAccount(event.locals.supabase, profile);
	return { account: own, impersonating: false };
}

export const load: PageServerLoad = async (event) => {
	// Staff and above only; a plain member gets a 403 rather than an empty page.
	const profile = await requireStaff(event);
	const abilities = can(profile);
	const { account, impersonating } = await resolveAccount(event, profile);

	if (!account) {
		return {
			account: null,
			threads: [],
			quota: null,
			impersonating: false,
			mailboxes: [],
			abilities
		};
	}

	const admin = supabaseAdmin();
	const folder = event.url.searchParams.get('folder') ?? 'inbox';

	let query = admin
		.from('mail_threads')
		.select('id,subject,last_message_at,message_count,unread_count,is_spam,archived_at')
		.eq('account_id', account.id)
		.order('last_message_at', { ascending: false })
		.limit(100);

	if (folder === 'archive') query = query.not('archived_at', 'is', null);
	else if (folder === 'spam') query = query.eq('is_spam', true);
	else query = query.is('archived_at', null).eq('is_spam', false);

	const [threads, quota, mailboxes] = await Promise.all([
		query,
		quotaFor(account.id),
		// The switcher only exists for superadmins; nobody else sees the list.
		abilities.readAnyMailbox
			? admin
					.from('mail_accounts')
					.select('id,address,label')
					.eq('is_active', true)
					.order('address')
					.limit(200)
			: Promise.resolve({ data: [] })
	]);

	return {
		account,
		sendingAddress: sendingAddressFor(account),
		threads: threads.data ?? [],
		quota,
		folder,
		impersonating,
		mailboxes: mailboxes.data ?? [],
		abilities
	};
};

export const actions: Actions = {
	send: async (event) => {
		const profile = await requireStaff(event);
		const { account } = await resolveAccount(event, profile);
		if (!account) return fail(400, { error: 'You do not have a mailbox yet.' });

		const form = await event.request.formData();
		const split = (key: string) =>
			String(form.get(key) ?? '')
				.split(/[,;\s]+/)
				.map((s) => s.trim().toLowerCase())
				.filter((s) => s.includes('@'));

		const result = await sendFromMailbox({
			account,
			to: split('to'),
			cc: split('cc'),
			subject: String(form.get('subject') ?? '').trim(),
			body: String(form.get('body') ?? '').trim(),
			files: form.getAll('files').filter((f): f is File => f instanceof File)
		});

		if (!result.ok) return fail(400, { error: result.error });
		return {
			success:
				result.remaining === null
					? 'Message sent.'
					: `Message sent. ${result.remaining} left today.`
		};
	}
};
