import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Shared-secret check for webhooks whose provider does not sign requests.
 *
 * Brevo's inbound parse webhook sends no signature, so a secret in the URL is
 * the only thing standing between the endpoint and anyone who guesses it.
 *
 * Plain JS, matching checkin-core.js: it keeps the node: import out of the
 * TypeScript route (the project has no @types/node) and lets selfcheck.mjs
 * import it directly.
 */

/**
 * Constant-time string comparison.
 *
 * Both sides are hashed first so the comparison is always over 32 bytes:
 * timingSafeEqual throws on length mismatch, and that throw would itself leak
 * the secret's length.
 *
 * @param {unknown} provided
 * @param {unknown} expected
 * @returns {boolean} false when either side is missing or empty
 */
export function secretMatches(provided, expected) {
	if (typeof provided !== 'string' || typeof expected !== 'string') return false;
	if (!provided || !expected) return false;
	const a = createHash('sha256').update(provided).digest();
	const b = createHash('sha256').update(expected).digest();
	return timingSafeEqual(a, b);
}
