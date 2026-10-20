/**
 * Pure check-in token logic: no env, no I/O, so it is directly testable.
 * See scripts/selfcheck.mjs.
 *
 * Token shape: `<eventId>.<slot>.<sig>` where `slot` is the index of the
 * rotation window and `sig` is a truncated HMAC-SHA256 over "eventId.slot".
 * Nothing is stored server-side: the signature *is* the proof.
 *
 * Web Crypto rather than node:crypto, so the same code runs on Node and on
 * Cloudflare's workerd runtime. nodejs_compat is not enough there: the
 * Cloudflare adapter's bundler cannot resolve a `node:` import at build time
 * whatever flags the deployed worker ends up running with.
 *
 * The cost is that signing is async, so issue() and verify() return promises.
 */

const encoder = new TextEncoder();

/**
 * base64url, without Buffer - which workerd also lacks.
 *
 * @param {Uint8Array} bytes
 */
function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * @param {string} secret
 * @param {string} eventId
 * @param {number} slot
 * @returns {Promise<string>}
 */
export async function signSlot(secret, eventId, slot) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${eventId}.${slot}`)
  );
  return base64url(new Uint8Array(sig)).slice(0, 32);
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
export async function issue(secret, eventId, windowSeconds, nowMs) {
  const slot = slotFor(nowMs, windowSeconds);
  return {
    token: `${eventId}.${slot}.${await signSlot(secret, eventId, slot)}`,
    slot,
    windowSeconds,
    expiresInMs: (slot + 1) * windowSeconds * 1000 - nowMs,
  };
}

/**
 * Constant-time comparison.
 *
 * Both sides are always the 32-character signature, so the loop length never
 * depends on the secret. node:crypto's timingSafeEqual is deliberately not
 * used: it throws on a length mismatch, and the throw itself is a signal.
 *
 * @param {string} a
 * @param {string} b
 */
function safeEqual(a, b) {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Accepts the current slot and the previous one, so a member who scans right
 * as the code flips still gets in.
 *
 * @param {string} secret
 * @param {string} token
 * @param {number} windowSeconds
 * @param {number} nowMs
 * @returns {Promise<{ok: true, eventId: string} | {ok: false, reason: 'malformed'|'expired'|'invalid'}>}
 */
export async function verify(secret, token, windowSeconds, nowMs) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const [eventId, slotStr, sig] = parts;
  const slot = Number(slotStr);
  if (!eventId || !slotStr || !Number.isInteger(slot))
    return { ok: false, reason: "malformed" };

  const now = slotFor(nowMs, windowSeconds);
  if (slot > now || slot < now - 1) return { ok: false, reason: "expired" };
  if (!safeEqual(sig, await signSlot(secret, eventId, slot))) {
    return { ok: false, reason: "invalid" };
  }

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
  return (
    nowMs >= new Date(startsAt).getTime() - grace &&
    nowMs <= new Date(endsAt).getTime() + grace
  );
}
