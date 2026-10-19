import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requireMember } from '$lib/server/guards';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { ensureAccount, sendFromMailbox, quotaFor } from '$lib/server/mail';
import { can } from '$lib/roles.js';
import type { Actions, PageServerLoad } from './$types';

/** The mailbox this thread belongs to, if the viewer is allowed to see it. */
async function authorizeThread(event: RequestEvent, profile: any) {
	const admin = supabaseAdmin();
	const { data: thread } = await admin
		.from('mail_threads')
		.select('id,subject,account_id,archived_at,is_spam')
		.eq('id', event.params.thread)
		.maybeSingle();
	if (!thread) throw error(404, 'Conversation not found');

	const { data: account } = await admin
		.from('mail_accounts')
		.select('id,address,label,member_id,daily_send_limit')
		.eq('id', thread.account_id)
		.maybeSingle();
	if (!account) throw error(404, 'Mailbox not found');

	// The only two ways in. RLS would also refuse, but the service-role client
	// above bypasses it, so this check is the real gate.
	const mine = account.member_id === profile.id;
	if (!mine && !can(profile).readAnyMailbox) {
		throw error(403, 'That mailbox is not yours');
	}

	return { thread, account, impersonating: !mine };
}

export const load: PageServerLoad = async (event) => {
	const profile = await requireMember(event);
	await ensureAccount(event.locals.supabase, profile);
	const { thread, account, impersonating } = await authorizeThread(event, profile);

	const admin = supabaseAdmin();
	const { data: messages } = await admin
		.from('mail_messages')
		.select(
			'id,direction,from_email,from_name,to_emails,cc_emails,subject,text_body,html_body,sent_at,read_at,message_id,references_ids,is_spam,mail_attachments(id,name,content_type,size_bytes)'
		)
		.eq('thread_id', thread.id)
		.order('sent_at', { ascending: true });

	// Opening a conversation marks it read. Not when a superadmin is looking at
	// somebody else's mail: that would tamper with their inbox.
	if (!impersonating) {
		await admin
			.from('mail_messages')
			.update({ read_at: new Date().toISOString() })
			.eq('thread_id', thread.id)
			.eq('direction', 'in')
			.is('read_at', null);
	}

	return {
		thread,
		account,
		impersonating,
		messages: messages ?? [],
		quota: await quotaFor(account.id)
	};
};

export const actions: Actions = {
	reply: async (event) => {
		const profile = await requireMember(event);
		const { thread, account, impersonating } = await authorizeThread(event, profile);
		if (impersonating) {
			return fail(403, { error: 'You cannot send from somebody else’s mailbox.' });
		}

		const form = await event.request.formData();
		const body = String(form.get('body') ?? '').trim();
		if (!body) return fail(400, { error: 'Write a reply first.' });

		const admin = supabaseAdmin();
		const { data: last } = await admin
			.from('mail_messages')
			.select('message_id,references_ids,from_email,subject')
			.eq('thread_id', thread.id)
			.order('sent_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		const to = String(form.get('to') ?? last?.from_email ?? '')
			.split(/[,;\s]+/)
			.map((s) => s.trim().toLowerCase())
			.filter((s) => s.includes('@'));

		const subject = thread.subject.toLowerCase().startsWith('re:')
			? thread.subject
			: `Re: ${thread.subject}`;

		const result = await sendFromMailbox({
			account,
			to,
			subject,
			body,
			files: form.getAll('files').filter((f): f is File => f instanceof File),
			threadId: thread.id,
			parent: last
				? { messageId: last.message_id, references: last.references_ids ?? [] }
				: null
		});

		if (!result.ok) return fail(400, { error: result.error });
		return { success: 'Reply sent.' };
	},

	archive: async (event) => {
		const profile = await requireMember(event);
		const { thread, impersonating } = await authorizeThread(event, profile);
		if (impersonating) return fail(403, { error: 'Read-only while viewing another mailbox.' });

		await supabaseAdmin()
			.from('mail_threads')
			.update({ archived_at: thread.archived_at ? null : new Date().toISOString() })
			.eq('id', thread.id);

		throw redirect(303, '/mail');
	}
};
