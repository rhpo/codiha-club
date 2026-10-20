import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/guards';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { materializeAttachment } from '$lib/server/mail';
import { can } from '$lib/roles.js';

/**
 * Serves one attachment.
 *
 * Inbound bytes live at Brevo behind a DownloadToken until somebody asks for
 * them, so the first request pulls the file across into storage and later ones
 * are served straight from there.
 */
export const GET: RequestHandler = async (event) => {
	const profile = await requireStaff(event);
	const admin = supabaseAdmin();

	const { data: attachment } = await admin
		.from('mail_attachments')
		.select('id,name,storage_path,content_type,message_id,download_token')
		.eq('id', event.params.id)
		.maybeSingle();
	if (!attachment) throw error(404, 'Attachment not found');

	// The service-role client above ignores RLS, so ownership is checked here.
	const { data: message } = await admin
		.from('mail_messages')
		.select('account_id,mail_accounts(member_id)')
		.eq('id', attachment.message_id)
		.maybeSingle();
	if (!message) throw error(404, 'Attachment not found');

	const ownerId = (message as Record<string, any>).mail_accounts?.member_id ?? null;
	if (ownerId !== profile.id && !can(profile).readAnyMailbox) {
		throw error(403, 'That attachment is not yours');
	}

	let path = attachment.storage_path;
	if (!path) {
		// Not pulled across yet; fetch it from Brevo with the saved token.
		path = await materializeAttachment(attachment.id, attachment.download_token ?? '');
		if (!path) throw error(410, 'That attachment is no longer available from the mail provider');
	}

	// A short-lived signed URL: the bucket itself stays private.
	const { data: signed } = await admin.storage
		.from('mail-attachments')
		.createSignedUrl(path, 60, { download: attachment.name });

	if (!signed?.signedUrl) throw error(500, 'Could not prepare the download');
	throw redirect(303, signed.signedUrl);
};
