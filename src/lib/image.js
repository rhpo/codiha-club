// @ts-nocheck
/**
 * Client-side image downscaling.
 *
 * A phone camera produces 3-10 MB files, and Netlify Functions reject a
 * request body over about 6 MB, so a straight pass-through fails at the edge
 * long before any limit of ours applies. Shrinking in the browser keeps the
 * upload small and means the member never waits on a pointless 10 MB POST for
 * an image that ends up 120 pixels wide.
 */

/** Anything larger is refused outright rather than silently processed. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Plenty for an avatar shown at 120px, and for the face check at 800px. */
const MAX_DIMENSION = 1280;
const QUALITY = 0.9;

/**
 * @param {File} file
 * @param {{maxDimension?: number, quality?: number}} [opts]
 * @returns {Promise<File>} the original when shrinking would not help
 */
export async function downscaleImage(file, opts = {}) {
	if (!(file instanceof File) || !file.type.startsWith('image/')) return file;
	// A GIF may be animated; re-encoding would silently drop that.
	if (file.type === 'image/gif') return file;

	const maxDimension = opts.maxDimension ?? MAX_DIMENSION;
	const quality = opts.quality ?? QUALITY;

	let bitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return file; // undecodable here; let the server reject it properly
	}

	const { width, height } = bitmap;
	const scale = Math.min(1, maxDimension / Math.max(width, height));

	// Already small enough, and re-encoding would only lose quality.
	if (scale === 1 && file.size <= 1_000_000) {
		bitmap.close?.();
		return file;
	}

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close?.();

	const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
	if (!blob || blob.size >= file.size) return file;

	const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
	return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
}

/** Human-readable size, for error copy. */
export function readableSize(bytes) {
	return bytes >= 1024 * 1024
		? `${(bytes / 1024 / 1024).toFixed(1)} MB`
		: `${Math.ceil(bytes / 1024)} KB`;
}
