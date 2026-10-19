import { env } from '$env/dynamic/private';
import { issue, isWindowOpen, verify } from './checkin-core.js';

/** How often the presentation-mode QR rotates, in seconds. */
export function windowSeconds(): number {
	const n = Number(env.CHECKIN_WINDOW_SECONDS ?? 30);
	return Number.isFinite(n) && n >= 5 ? n : 30;
}

function secret(): string {
	const s = env.CHECKIN_SECRET;
	if (!s || s.length < 16) {
		throw new Error('CHECKIN_SECRET is missing or too short (need 16+ characters)');
	}
	return s;
}

export function issueCheckinToken(eventId: string) {
	return issue(secret(), eventId, windowSeconds(), Date.now());
}

export type CheckinTokenResult = ReturnType<typeof verifyCheckinToken>;

export function verifyCheckinToken(token: string) {
	return verify(secret(), token, windowSeconds(), Date.now());
}

export function isCheckinWindowOpen(startsAt: string, endsAt: string, at = Date.now()): boolean {
	return isWindowOpen(startsAt, endsAt, at);
}
