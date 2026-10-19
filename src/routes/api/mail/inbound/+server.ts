import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { secretMatches } from '$lib/server/webhook-auth.js';
import { matchThread, normalizeInboundItem, SUBJECT_WINDOW_MS } from '$lib/server/mail-core.js';

/**
 * Brevo inbound parse webhook.
 *
 * Brevo does NOT sign these requests, so the only thing standing between this
 * endpoint and anyone who guesses the URL is a shared secret. Without it a
 * stranger could inject messages that look like they came from the president,
 * so a missing secret fails closed rather than running unauthenticated.
 *
 * Configure the webhook URL in Brevo as:
 *   https://club.codiha.com/api/mail/inbound?key=<MAIL_INBOUND_SECRET>
 */

export const POST: RequestHandler = async ({ request, url }) => {
	const expected = env.MAIL_INBOUND_SECRET;
	if (!expected) {
		// Fail closed: an unset secret must not mean "accept everything".
		throw error(503, 'Inbound mail is not configured');
	}

	const provided = url.searchParams.get('key') ?? request.headers.get('x-webhook-key') ?? '';
	if (!provided || !secretMatches(provided, expected)) {
		throw error(401, 'Bad webhook key');
	}

	let payload: { items?: unknown[] };
	try {
		payload = await request.json();
	} catch {
		throw error(400, 'Body is not JSON');
	}

	const items = Array.isArray(payload?.items) ? payload.items : [];
	if (!items.length) return json({ ok: true, stored: 0 });

	const sb = supabaseAdmin();
	let stored = 0;
	let skipped = 0;

	for (const raw of items) {
		const msg = normalizeInboundItem(raw as Record<string, unknown>);

		// Which of our addresses was this sent to? Brevo lists every recipient,
		// including ones belonging to other domains, so match against accounts.
		const candidates = [...msg.to, ...msg.recipients, ...msg.cc];
		if (!candidates.length) {
			skipped++;
			continue;
		}

		const { data: account } = await sb
			.from('mail_accounts')
			.select('id')
			.in('address', candidates)
			.eq('is_active', true)
			.limit(1)
			.maybeSingle();

		if (!account) {
			// Mail for an address we do not own. Dropping it is correct; Brevo
			// accepts anything at the domain, including typos and spam.
			skipped++;
			continue;
		}

		// Retries are expected (Brevo redelivers on non-2xx), so the unique
		// index on brevo_uuid is the real guard; this just avoids the work.
		if (msg.brevoUuid) {
			const { data: seen } = await sb
				.from('mail_messages')
				.select('id')
				.eq('brevo_uuid', msg.brevoUuid)
				.maybeSingle();
			if (seen) {
				skipped++;
				continue;
			}
		}

		const sentAtMs = msg.sentAt ? Date.parse(msg.sentAt) : Date.now();

		// Only threads that could plausibly match: same account, and either a
		// header link or a recent identical subject.
		const since = new Date(sentAtMs - SUBJECT_WINDOW_MS).toISOString();
		const { data: threadRows } = await sb
			.from('mail_threads')
			.select('id,normalized_subject,last_message_at,mail_messages(message_id)')
			.eq('account_id', account.id)
			.gte('last_message_at', since)
			.order('last_message_at', { ascending: false })
			.limit(200);

		const threads = (threadRows ?? []).map((t: Record<string, any>) => ({
			id: t.id,
			normalizedSubject: t.normalized_subject,
			lastMessageAt: Date.parse(t.last_message_at),
			messageIds: (t.mail_messages ?? []).map((m: { message_id: string }) => m.message_id).filter(Boolean)
		}));

		const match = matchThread(
			{
				inReplyTo: msg.inReplyTo,
				references: msg.references,
				subject: msg.subject,
				sentAt: sentAtMs
			},
			threads
		);

		let threadId = match?.threadId;
		if (!threadId) {
			const { data: created, error: threadError } = await sb
				.from('mail_threads')
				.insert({
					account_id: account.id,
					subject: msg.subject,
					normalized_subject: msg.normalizedSubject,
					last_message_at: msg.sentAt ?? new Date().toISOString(),
					is_spam: msg.isSpam
				})
				.select('id')
				.single();
			if (threadError || !created) {
				skipped++;
				continue;
			}
			threadId = created.id;
		}

		const { data: inserted, error: messageError } = await sb
			.from('mail_messages')
			.insert({
				thread_id: threadId,
				account_id: account.id,
				direction: 'in',
				brevo_uuid: msg.brevoUuid,
				message_id: msg.messageId,
				in_reply_to: msg.inReplyTo,
				references_ids: msg.references,
				from_email: msg.fromEmail,
				from_name: msg.fromName,
				to_emails: msg.to,
				cc_emails: msg.cc,
				subject: msg.subject,
				text_body: msg.textBody,
				html_body: msg.htmlBody,
				spam_score: msg.spamScore,
				is_spam: msg.isSpam,
				sent_at: msg.sentAt ?? new Date().toISOString()
			})
			.select('id')
			.single();

		if (messageError || !inserted) {
			// A duplicate here means a concurrent retry won the race, which is
			// the unique index doing its job. Not an error worth retrying.
			skipped++;
			continue;
		}

		if (msg.attachments.length) {
			// Bytes are fetched later with the DownloadToken; the row exists now
			// so the UI can show the filename immediately.
			await sb.from('mail_attachments').insert(
				msg.attachments.map((a) => ({
					message_id: inserted.id,
					name: a.name,
					content_type: a.contentType,
					size_bytes: a.size,
					content_id: a.contentId,
					download_token: a.downloadToken,
					storage_path: null
				}))
			);
		}

		stored++;
	}

	// 200 even when everything was skipped: a non-2xx makes Brevo redeliver,
	// and redelivering mail we deliberately dropped would loop forever.
	return json({ ok: true, stored, skipped });
};
