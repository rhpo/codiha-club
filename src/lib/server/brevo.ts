import { env } from '$env/dynamic/private';
import { derive, resolveTheme, type Theme } from '$lib/theme';

export interface MailRecipient {
	email: string;
	name?: string;
}

export interface MailAttachment {
	/** base64 (no data: prefix) */
	content: string;
	name: string;
}

export interface SendMailInput {
	recipients: MailRecipient[];
	subject: string;
	html: string;
	attachments?: MailAttachment[];
	replyTo?: string;
	/** Override the From address. Must be on an authenticated Brevo domain. */
	sender?: MailRecipient;
	/** Extra RFC headers, e.g. In-Reply-To / References for threading. */
	headers?: Record<string, string>;
}

export interface SendMailResult {
	sent: number;
	failed: number;
	providerRef: string | null;
	error: string | null;
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
/** Brevo allows up to 1000 messageVersions per request; stay well under. */
const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

/**
 * One request per 500 recipients using Brevo `messageVersions`, so recipients
 * never see each other and we never loop 300 HTTP calls inside a serverless
 * function with a 10s budget.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
	const apiKey = env.BREVO_API_KEY;
	const senderEmail = env.BREVO_SENDER_EMAIL;
	if (!apiKey) return { sent: 0, failed: input.recipients.length, providerRef: null, error: 'BREVO_API_KEY is not set' };
	if (!senderEmail) return { sent: 0, failed: input.recipients.length, providerRef: null, error: 'BREVO_SENDER_EMAIL is not set' };

	const clean = input.recipients.filter((r) => r.email && r.email.includes('@'));
	if (!clean.length) return { sent: 0, failed: 0, providerRef: null, error: 'No valid recipients' };

	const sender = input.sender?.email
		? { email: input.sender.email, name: input.sender.name || env.BREVO_SENDER_NAME || 'CODIHA Club' }
		: { email: senderEmail, name: env.BREVO_SENDER_NAME || 'CODIHA Club' };
	const replyTo = input.replyTo || env.BREVO_REPLY_TO || senderEmail;

	let sent = 0;
	let failed = 0;
	let providerRef: string | null = null;
	const errors: string[] = [];

	for (const group of chunk(clean, CHUNK)) {
		const body: Record<string, unknown> = {
			sender,
			replyTo: { email: replyTo },
			subject: input.subject,
			htmlContent: input.html,
			// Brevo requires a top-level `to`; it is overridden per version.
			to: [{ email: group[0].email, name: group[0].name || undefined }]
		};

		if (group.length > 1) {
			body.messageVersions = group.map((r) => ({
				to: [{ email: r.email, name: r.name || undefined }]
			}));
		}

		if (input.headers && Object.keys(input.headers).length) {
			// Brevo passes these straight through, which is what makes a reply
			// thread correctly in the recipient's client.
			body.headers = input.headers;
		}

		if (input.attachments?.length) {
			body.attachment = input.attachments.map((a) => ({ content: a.content, name: a.name }));
		}

		try {
			const res = await fetch(BREVO_URL, {
				method: 'POST',
				headers: {
					'api-key': apiKey,
					'content-type': 'application/json',
					accept: 'application/json'
				},
				body: JSON.stringify(body)
			});
			const text = await res.text();
			if (!res.ok) {
				failed += group.length;
				errors.push(`${res.status}: ${text.slice(0, 300)}`);
				continue;
			}
			sent += group.length;
			try {
				const json = JSON.parse(text);
				providerRef ??= json.messageId ?? json.messageIds?.[0] ?? null;
			} catch {
				/* Brevo returns an empty body for some versions, which is not an error */
			}
		} catch (e) {
			failed += group.length;
			errors.push(e instanceof Error ? e.message : String(e));
		}
	}

	return { sent, failed, providerRef, error: errors.length ? errors.join(' | ') : null };
}

/**
 * Shell used for every club email so admins only write the inner body.
 * `theme` keeps the mail in step with the palette saved in Admin → Appearance;
 * omit it and the shipped CODIHA colours are used.
 */
export function wrapHtml(bodyHtml: string, siteUrl: string, theme?: Theme | null): string {
	const c = derive(resolveTheme(theme));
	return `<!doctype html>
<html><body style="margin:0;padding:0;background:${c.deeper};font-family:Inter,Segoe UI,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(176deg,${c.light} 50%,${c.primary} 100%);border-radius:16px;padding:28px;color:#fff;">
      <div style="font-size:22px;font-weight:700;letter-spacing:1px;margin-bottom:4px;">CODIHA CLUB</div>
      <div style="font-size:12px;opacity:.75;margin-bottom:20px;">Inter-university IT Club &middot; ESST Algiers</div>
      <div style="background:rgba(255,255,255,.08);border:1px solid rgba(166,197,197,.35);border-radius:12px;padding:20px;font-size:15px;line-height:1.6;color:#fff;">
        ${bodyHtml}
      </div>
      <div style="margin-top:20px;font-size:12px;opacity:.7;">
        <a href="${siteUrl}" style="color:${c.accent};text-decoration:none;">club.codiha.com</a>
        &nbsp;&middot;&nbsp; You are receiving this because you are a CODIHA Club member.
      </div>
    </div>
  </div>
</body></html>`;
}
