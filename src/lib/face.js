// @ts-nocheck
/**
 * Browser-side face detection for profile pictures.
 *
 * Uses the tiny face detector from @vladmandic/face-api, whose weights are
 * self-hosted in static/models (190 KB) rather than pulled from a CDN at
 * runtime. The library itself is imported lazily, so the ~1.5 MB bundle only
 * loads on the page that actually needs it.
 *
 * This is a usability gate, not a security control: everything here runs in
 * the member's own browser and could be bypassed by anyone determined enough.
 * The point is to stop people using a cartoon, not to defeat an attacker.
 */

const MODEL_URL = '/models';

/** Tried in order until a face turns up. See the comment in detectFace(). */
const INPUT_SIZES = [416, 608, 800];

/** Low enough for a dim phone photo, high enough that a logo is not a face. */
const SCORE_THRESHOLD = 0.35;

let loader = null;
let api = null;

/** Loads the library and weights once; later calls reuse the same promise. */
async function ready() {
	if (!loader) {
		loader = (async () => {
			const faceapi = await import('@vladmandic/face-api');
			await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
			api = faceapi;
			return faceapi;
		})().catch((e) => {
			// Reset so a transient network failure can be retried rather than
			// poisoning every later attempt.
			loader = null;
			throw e;
		});
	}
	return loader;
}

/** Start fetching the model early, e.g. when the photo page mounts. */
export function warmUp() {
	ready().catch(() => {
		/* preloading is best effort */
	});
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ok: boolean, faces: number, reason?: string}>}
 *
 * `ok: true` means exactly one face was found. Zero is a rejection; more than
 * one is too, because a group photo does not identify the member.
 */
export async function detectFace(file) {
	if (!file) return { ok: false, faces: 0, reason: 'no-file' };

	let faceapi;
	try {
		faceapi = await ready();
	} catch {
		// The detector could not load at all. Refusing the upload here would
		// lock the member out over a failed asset fetch, so let it through and
		// leave the picture unverified for an admin to confirm.
		return { ok: false, faces: 0, reason: 'unavailable' };
	}

	const url = URL.createObjectURL(file);
	try {
		const img = await loadImage(url);
		// The detector sees a square of inputSize pixels, so on a tall phone
		// photo (a 1980x3520 portrait is typical) a face can shrink below the
		// point of being detectable. Measured on a real photo from this site:
		// nothing at all at 416 or 608, found at 0.57 confidence at 800.
		//
		// So escalate rather than picking one size: a head-and-shoulders selfie
		// hits on the first pass, and only a photo with no face pays for all
		// three.
		let found = [];
		for (const inputSize of INPUT_SIZES) {
			found = await faceapi.detectAllFaces(
				img,
				new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: SCORE_THRESHOLD })
			);
			if (found.length) break;
		}

		if (found.length === 0) return { ok: false, faces: 0, reason: 'no-face' };
		if (found.length > 1) return { ok: false, faces: found.length, reason: 'many-faces' };
		return { ok: true, faces: 1 };
	} catch {
		return { ok: false, faces: 0, reason: 'unreadable' };
	} finally {
		URL.revokeObjectURL(url);
	}
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

/** Human-readable reason, for the form to show. */
export const FACE_MESSAGES = {
	'no-file': 'Choose a photo first.',
	'no-face': 'No face found in that photo. Use a clear, well-lit photo of yourself.',
	'many-faces': 'That photo has more than one person in it. Use a photo of just you.',
	unreadable: 'That image could not be read. Try a different file.',
	unavailable: 'The face check could not run. Your photo was saved for review.'
};
