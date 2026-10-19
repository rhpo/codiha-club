import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Pure check-in token logic: no env, no I/O, so it is directly testable.
 * See scripts/selfcheck.mjs.
 *
 * Token shape: `<eventId>.<slot>.<sig>` where `slot` is the index of the
 * rotation window and `sig` is a truncated HMAC-SHA256 over "eventId.slot".
 * Nothing is stored server-side: the signature *is* the proof.
 */

/**
 * @param {string} secret
 * @param {string} eventId
 * @param {number} slot
 */
export function signSlot(secret, eventId, slot) {
	return createHmac('sha256', secret).update(`${eventId}.${slot}`).digest('base64url').slice(0, 32);
}

/**
 * @param {number} nowMs
 * @param {number} windowSeconds
 */
export function slotFor(nowMs, windowSeconds) {
	return Math.floor(nowMs / 1000 / windowSeconds);
}

/**
 * @param {string} secret
 * @param {string} eventId
 * @param {number} windowSeconds
 * @param {number} nowMs
 */
export function issue(secret, eventId, windowSeconds, nowMs) {
	const slot = slotFor(nowMs, windowSeconds);
	return {
		token: `${eventId}.${slot}.${signSlot(secret, eventId, slot)}`,
		slot,
		windowSeconds,
		expiresInMs: (slot + 1) * windowSeconds * 1000 - nowMs
	};
}

/** @param {string} a @param {string} b */
function safeEqual(a, b) {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Accepts the current slot and the previous one, so a member who scans right
 * as the code flips still gets in.
 *
 * @param {string} secret
 * @param {string} token
 * @param {number} windowSeconds
 * @param {number} nowMs
 * @returns {{ok: true, eventId: string} | {ok: false, reason: 'malformed'|'expired'|'invalid'}}
 */
export function verify(secret, token, windowSeconds, nowMs) {
	const parts = String(token ?? '').split('.');
	if (parts.length !== 3) return { ok: false, reason: 'malformed' };

	const [eventId, slotStr, sig] = parts;
	const slot = Number(slotStr);
	if (!eventId || !slotStr || !Number.isInteger(slot)) return { ok: false, reason: 'malformed' };

	const now = slotFor(nowMs, windowSeconds);
	if (slot > now || slot < now - 1) return { ok: false, reason: 'expired' };
	if (!safeEqual(sig, signSlot(secret, eventId, slot))) return { ok: false, reason: 'invalid' };

	return { ok: true, eventId };
}

/**
 * Check-in is only open from 1h before the start until 1h after the end.
 *
 * @param {string} startsAt
 * @param {string} endsAt
 * @param {number} nowMs
 */
export function isWindowOpen(startsAt, endsAt, nowMs) {
	const grace = 60 * 60 * 1000;
	return nowMs >= new Date(startsAt).getTime() - grace && nowMs <= new Date(endsAt).getTime() + grace;
}
