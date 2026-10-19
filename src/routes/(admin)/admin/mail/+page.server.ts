import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards';
import { sendMail, wrapHtml } from '$lib/server/brevo';
import { loadTheme } from '$lib/server/settings';
import { fileToAttachment } from '$lib/server/upload';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

type Recipient = { email: string; name?: string };

export const load: PageServerLoad = async (event) => {
	await requireAdmin(event);
	const sb = event.locals.supabase;

	const [profiles, events, hackathons, log] = await Promise.all([
		sb
			.from('profiles')
			.select('id,full_name,email,status,role,university')
			.not('email', 'is', null)
			.order('full_name', { ascending: true }),
		sb.from('events').select('id,title,starts_at').order('starts_at', { ascending: false }).limit(50),
		sb.from('hackathons').select('id,title').order('starts_at', { ascending: false }).limit(50),
		sb
			.from('email_log')
			.select('*,profiles:sent_by(full_name)')
			.order('created_at', { ascending: false })
			.limit(15)
	]);

	const all = profiles.data ?? [];
	return {
		members: all,
		audienceCounts: {
			all: all.length,
			approved: all.filter((m) => m.status === 'approved').length,
			pending: all.filter((m) => m.status === 'pending').length,
			admins: all.filter((m) => m.role === 'admin').length
		},
		events: events.data ?? [],
		hackathons: hackathons.data ?? [],
		log: log.data ?? [],
		sender: {
			email: env.BREVO_SENDER_EMAIL ?? null,
			name: env.BREVO_SENDER_NAME ?? null,
			configured: !!env.BREVO_API_KEY
		}
	};
};

export const actions: Actions = {
	send: async (event) => {
		const admin = await requireAdmin(event);
		const sb = event.locals.supabase;
		const form = await event.request.formData();

		const subject = String(form.get('subject') ?? '').trim();
		const body = String(form.get('body') ?? '').trim();
		const audience = String(form.get('audience') ?? 'approved');
		const asHtml = form.get('as_html') === '1';

		if (!subject) return fail(400, { error: 'Subject is required.' });
		if (body.length < 5) return fail(400, { error: 'Write a message body.' });

		// ---- build the recipient list -------------------------------------
		let recipients: Recipient[] = [];
		let audienceLabel = audience;

		const fromProfiles = (rows: any[]) =>
			rows
				.filter((r) => r?.email)
				.map((r) => ({ email: r.email as string, name: r.full_name ?? undefined }));

		if (audience === 'event') {
			const eventId = String(form.get('event_id') ?? '');
			if (!eventId) return fail(400, { error: 'Pick an event.' });
			const { data } = await sb
				.from('event_registrations')
				.select('profiles:member_id(full_name,email)')
				.eq('event_id', eventId)
				.neq('status', 'cancelled');
			recipients = fromProfiles((data ?? []).map((r: any) => r.profiles));
			audienceLabel = `event:${eventId}`;
		} else if (audience === 'hackathon') {
			const hackathonId = String(form.get('hackathon_id') ?? '');
			const appStatus = String(form.get('application_status') ?? 'all');
			if (!hackathonId) return fail(400, { error: 'Pick a hackathon.' });
			let q = sb
				.from('hackathon_applications')
				.select('status,profiles:member_id(full_name,email)')
				.eq('hackathon_id', hackathonId);
			if (appStatus !== 'all') q = q.eq('status', appStatus);
			const { data } = await q;
			recipients = fromProfiles((data ?? []).map((r: any) => r.profiles));
			audienceLabel = `hackathon:${hackathonId}:${appStatus}`;
		} else if (audience === 'custom') {
			recipients = String(form.get('custom_emails') ?? '')
				.split(/[\s,;]+/)
				.map((e) => e.trim())
				.filter((e) => e.includes('@'))
				.map((email) => ({ email }));
			audienceLabel = 'custom';
		} else if (audience === 'selected') {
			const ids = form.getAll('member_ids').map(String).filter(Boolean);
			if (!ids.length) return fail(400, { error: 'Select at least one member.' });
			const { data } = await sb.from('profiles').select('full_name,email').in('id', ids);
			recipients = fromProfiles(data ?? []);
			audienceLabel = `selected:${ids.length}`;
		} else {
			let q = sb.from('profiles').select('full_name,email').not('email', 'is', null);
			if (audience === 'approved') q = q.eq('status', 'approved');
			else if (audience === 'pending') q = q.eq('status', 'pending');
			else if (audience === 'admins') q = q.eq('role', 'admin');
			const { data } = await q;
			recipients = fromProfiles(data ?? []);
		}

		// de-duplicate: a member can be registered and selected at once
		const seen = new Set<string>();
		recipients = recipients.filter((r) => {
			const key = r.email.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});

		if (!recipients.length) return fail(400, { error: 'That audience has no email addresses.' });

		// ---- attachments ---------------------------------------------------
		const attachments = [];
		let totalBytes = 0;
		try {
			for (const file of form.getAll('attachments')) {
				const att = await fileToAttachment(file);
				if (!att) continue;
				totalBytes += att.size;
				if (totalBytes > 10 * 1024 * 1024) {
					return fail(400, { error: 'Attachments total more than 10 MB, which Brevo will reject.' });
				}
				attachments.push({ name: att.name, content: att.content });
			}
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Attachment failed' });
		}

		const html = wrapHtml(
			asHtml ? body : body.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br/>'),
			event.url.origin,
			await loadTheme(sb)
		);

		// ---- log first so a provider timeout still leaves a trace ----------
		const { data: logRow } = await sb
			.from('email_log')
			.insert({
				subject,
				html,
				audience: audienceLabel,
				recipients: recipients.map((r) => r.email),
				recipient_count: recipients.length,
				attachments: attachments.map((a) => a.name),
				status: 'queued',
				sent_by: admin.id
			})
			.select('id')
			.maybeSingle();

		const result = await sendMail({ recipients, subject, html, attachments });

		const status = result.failed === 0 ? 'sent' : result.sent === 0 ? 'failed' : 'partial';
		if (logRow) {
			await sb
				.from('email_log')
				.update({ status, provider_ref: result.providerRef, error: result.error })
				.eq('id', logRow.id);
		}

		if (status === 'failed') {
			return fail(502, { error: result.error ?? 'Brevo rejected the request.' });
		}

		return {
			success: `Sent to ${result.sent} recipient(s)${
				result.failed ? ` · ${result.failed} failed` : ''
			}${attachments.length ? ` · ${attachments.length} attachment(s)` : ''}.`,
			warning: result.error
		};
	}
};
