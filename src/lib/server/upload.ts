import { supabaseAdmin } from './supabaseAdmin';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'];
/** Avatars are shown at 64px at most, so 2 MB is already generous. */
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Upload an event/hackathon cover to the public `covers` bucket.
 * Returns the public URL, or null when no file was supplied.
 * Throws a human-readable Error for the form to surface.
 */
export async function uploadCover(file: unknown, prefix: string): Promise<string | null> {
	if (!(file instanceof File) || file.size === 0) return null;
	if (!ALLOWED.includes(file.type)) {
		throw new Error('Cover must be a PNG, JPEG, WebP, AVIF or GIF image.');
	}
	if (file.size > MAX_BYTES) throw new Error('Cover must be smaller than 5 MB.');

	const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
	const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
	const admin = supabaseAdmin();

	const { error } = await admin.storage
		.from('covers')
		.upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

	if (error) throw new Error(`Cover upload failed: ${error.message}`);

	return admin.storage.from('covers').getPublicUrl(path).data.publicUrl;
}

/**
 * Upload a member's profile picture to the public `avatars` bucket.
 *
 * The path is keyed by member id and overwritten on each change, so a member
 * leaves one file behind rather than one per upload. The returned URL carries
 * a cache-buster: the path never changes, so without it browsers keep showing
 * the old picture indefinitely.
 */
export async function uploadAvatar(file: unknown, memberId: string): Promise<string | null> {
	if (!(file instanceof File) || file.size === 0) return null;
	if (!ALLOWED.includes(file.type)) {
		throw new Error('Your picture must be a PNG, JPEG, WebP, AVIF or GIF image.');
	}
	if (file.size > AVATAR_MAX_BYTES) {
		throw new Error('Your picture must be smaller than 2 MB.');
	}

	const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
	const path = `${memberId}/avatar.${ext}`;
	const admin = supabaseAdmin();

	const { error } = await admin.storage
		.from('avatars')
		.upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });

	if (error) throw new Error(`Picture upload failed: ${error.message}`);

	const url = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
	return `${url}?v=${Date.now()}`;
}

/** base64-encode an admin mail attachment for the Brevo payload. */
export async function fileToAttachment(file: unknown) {
	if (!(file instanceof File) || file.size === 0) return null;
	if (file.size > 8 * 1024 * 1024) {
		throw new Error(`Attachment "${file.name}" is larger than 8 MB.`);
	}
	const buf = Buffer.from(await file.arrayBuffer());
	return { name: file.name, content: buf.toString('base64'), size: file.size };
}
