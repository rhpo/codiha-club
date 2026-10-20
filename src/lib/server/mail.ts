import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendMail } from '$lib/server/brevo';
import { normalizeSubject, replyHeaders, swapDomain } from '$lib/server/mail-core.js';
import { can, quotaState } from '$lib/roles.js';

/** Brevo caps a single message at 10 MB including every attachment. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface MailAccount {
	id: string;
	address: string;
	label: string | null;
	member_id: string | null;
	daily_send_limit: number | null;
}

/** The address Brevo hands replies back to, derived from the inbound domain. */
export function inboundAddressFor(localPart: string): string {
	const domain = (env.MAIL_INBOUND_DOMAIN || '').trim().replace(/^@/, '');
	return domain ? `${localPart}@${domain}` : localPart;
}

/**
 * Turns a name into the local part of an address: "Ramy Hadid" -> "ramy.hadid".
 * Collisions are the caller's problem; the unique index catches them.
 */
export function localPartFor(fullName: string, fallback: string): string {
	const base = String(fullName ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '.')
		.replace(/^\.+|\.+$/g, '')
		.slice(0, 40);
	return base || fallback;
}

/** The signed-in member's mailbox, created on first use. */
export async function ensureAccount(
	sb: SupabaseClient,
	member: { id: string; full_name: string; email: string | null; role?: string; status?: string }
): Promise<MailAccount | null> {
	const admin = supabaseAdmin();

	// Staff and above only. An existing mailbox is still returned below, so
	// demoting somebody does not destroy their history; it just stops new
	// addresses being handed out.
	if (!can(member).useMailbox) {
		const { data: kept } = await admin
			.from('mail_accounts')
			.select('id,address,label,member_id,daily_send_limit')
			.eq('member_id', member.id)
			.maybeSingle();
		return (kept as MailAccount) ?? null;
	}

	const { data: existing } = await admin
		.from('mail_accounts')
		.select('id,address,label,member_id,daily_send_limit')
		.eq('member_id', member.id)
		.maybeSingle();
	if (existing) return existing as MailAccount;

	if (!env.MAIL_INBOUND_DOMAIN) return null;

	// Append a short suffix only when the pretty name is taken, so the common
	// case stays readable.
	const base = localPartFor(member.full_name, member.id.slice(0, 8));
	for (const candidate of [base, `${base}.${member.id.slice(0, 4)}`]) {
		const address = inboundAddressFor(candidate);
		const { data, error } = await admin
			.from('mail_accounts')
			.insert({ member_id: member.id, address, label: member.full_name })
			.select('id,address,label,member_id,daily_send_limit')
			.maybeSingle();
		if (data) return data as MailAccount;
		// 23505 is the unique index on lower(address): try the suffixed form.
		if (error && error.code !== '23505') return null;
	}
	return null;
}

export async function quotaFor(accountId: string) {
	const { data } = await supabaseAdmin()
		.from('mail_accounts')
		.select('daily_send_limit')
		.eq('id', accountId)
		.maybeSingle();

	const { count } = await supabaseAdmin()
		.from('mail_messages')
		.select('id', { count: 'exact', head: true })
		.eq('account_id', accountId)
		.eq('direction', 'out')
		.gte('sent_at', new Date(new Date().toISOString().slice(0, 10)).toISOString());

	return quotaState({ used: count ?? 0, daily_send_limit: data?.daily_send_limit ?? null });
}

/** base64 for Brevo, which takes the bytes inline on send. */
async function fileToBase64(file: File): Promise<string> {
	const buf = new Uint8Array(await file.arrayBuffer());
	let binary = '';
	for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
	return btoa(binary);
}

export interface SendFromMailboxInput {
	account: MailAccount;
	to: string[];
	cc?: string[];
	subject: string;
	body: string;
	files?: File[];
	/** Set when replying, so the message joins an existing thread. */
	threadId?: string | null;
	parent?: { messageId: string | null; references: string[] } | null;
}

/**
 * The From address for a mailbox.
 *
 * Brevo needs the From to sit on the authenticated *sending* domain, and
 * refuses to receive on that same domain, so a member has two halves to one
 * identity: they send as `name@team.codiha.com` and receive at
 * `name@inbox.codiha.com`.
 *
 * Keeping the local part identical is what makes that readable. Sending every
 * member's mail as the club's shared address instead made the From useless:
 * recipients could not tell who had written to them, and the sender could not
 * find their own message by searching for their address.
 */
export function sendingAddressFor(account: { address: string }): string {
	const fallback = env.BREVO_SENDER_EMAIL ?? '';
	// Falls back to the club's own address when the domains are not configured,
	// rather than inventing a From that Brevo would refuse.
	return swapDomain(account.address, fallback.split('@')[1] ?? '') ?? fallback;
}

/**
 * Sends from a member's mailbox and records it.
 *
 * From is the member on the sending domain, Reply-To is the member on the
 * inbound domain, so answers come back through the webhook into their inbox.
 */
export async function sendFromMailbox(input: SendFromMailboxInput) {
	const admin = supabaseAdmin();

	const quota = await quotaFor(input.account.id);
	if (quota.exceeded) {
		return {
			ok: false as const,
			error: `Daily limit reached (${quota.limit} messages). It resets at midnight UTC.`
		};
	}

	const to = input.to.filter((a) => a && a.includes('@'));
	if (!to.length) return { ok: false as const, error: 'Add at least one recipient.' };
	if (!input.subject.trim()) return { ok: false as const, error: 'A subject is required.' };

	const files = (input.files ?? []).filter((f) => f && f.size > 0);
	const total = files.reduce((sum, f) => sum + f.size, 0);
	if (total > MAX_ATTACHMENT_BYTES) {
		return { ok: false as const, error: 'Attachments total more than 10 MB, which Brevo rejects.' };
	}

	const attachments = [];
	for (const file of files) {
		attachments.push({ name: file.name, content: await fileToBase64(file) });
	}

	const html = input.body
		.split(/\n{2,}/)
		.map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
		.join('');

	const result = await sendMail({
		recipients: to.map((email) => ({ email })),
		subject: input.subject,
		html,
		attachments,
		sender: { email: sendingAddressFor(input.account), name: input.account.label ?? undefined },
		replyTo: input.account.address,
		headers: input.parent ? replyHeaders(input.parent) : undefined
	});

	if (!result.sent) {
		return { ok: false as const, error: result.error ?? 'The mail provider rejected the message.' };
	}

	// Record it only after Brevo accepted it, so the quota counts real sends.
	let threadId = input.threadId ?? null;
	if (!threadId) {
		const { data: thread } = await admin
			.from('mail_threads')
			.insert({
				account_id: input.account.id,
				subject: input.subject,
				normalized_subject: normalizeSubject(input.subject),
				last_message_at: new Date().toISOString()
			})
			.select('id')
			.single();
		threadId = thread?.id ?? null;
	}
	if (!threadId) return { ok: false as const, error: 'Sent, but the thread could not be saved.' };

	const { data: message } = await admin
		.from('mail_messages')
		.insert({
			thread_id: threadId,
			account_id: input.account.id,
			direction: 'out',
			message_id: result.providerRef,
			in_reply_to: input.parent?.messageId ?? null,
			references_ids: input.parent ? [...(input.parent.references ?? []), input.parent.messageId].filter(Boolean) : [],
			from_email: input.account.address,
			from_name: input.account.label,
			to_emails: to,
			cc_emails: input.cc ?? [],
			subject: input.subject,
			text_body: input.body,
			html_body: html,
			sent_at: new Date().toISOString(),
			read_at: new Date().toISOString()
		})
		.select('id')
		.single();

	if (message && files.length) {
		for (const file of files) {
			const path = `${input.account.id}/${message.id}/${file.name}`;
			await admin.storage
				.from('mail-attachments')
				.upload(path, file, { contentType: file.type || undefined, upsert: true });
			await admin.from('mail_attachments').insert({
				message_id: message.id,
				name: file.name,
				content_type: file.type || 'application/octet-stream',
				size_bytes: file.size,
				storage_path: path
			});
		}
	}

	return {
		ok: true as const,
		threadId,
		remaining: quota.remaining === null ? null : Math.max(0, quota.remaining - 1)
	};
}

/**
 * Pulls an inbound attachment's bytes from Brevo and parks them in storage.
 *
 * Brevo hands over a DownloadToken rather than the file, so this runs lazily
 * the first time somebody opens the attachment.
 */
export async function materializeAttachment(attachmentId: string, downloadToken: string) {
	const apiKey = env.BREVO_API_KEY;
	if (!apiKey) return null;

	const admin = supabaseAdmin();
	const { data: row } = await admin
		.from('mail_attachments')
		.select('id,name,content_type,storage_path,message_id')
		.eq('id', attachmentId)
		.maybeSingle();
	if (!row) return null;
	if (row.storage_path) return row.storage_path;

	const res = await fetch(
		`https://api.brevo.com/v3/inbound/attachments/${encodeURIComponent(downloadToken)}`,
		{ headers: { 'api-key': apiKey } }
	);
	if (!res.ok) return null;

	const bytes = new Uint8Array(await res.arrayBuffer());
	const path = `inbound/${row.message_id}/${row.id}-${row.name}`;
	const { error } = await admin.storage
		.from('mail-attachments')
		.upload(path, bytes, { contentType: row.content_type, upsert: true });
	if (error) return null;

	// Token is single-use-ish and no longer needed once the bytes are ours.
	await admin
		.from('mail_attachments')
		.update({ storage_path: path, download_token: null })
		.eq('id', row.id);
	return path;
}
