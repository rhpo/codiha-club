/**
 * Shared-secret check for webhooks whose provider does not sign requests.
 *
 * Brevo's inbound parse webhook sends no signature, so a secret in the URL is
 * the only thing standing between the endpoint and anyone who guesses it.
 *
 * Web Crypto rather than node:crypto, for the same reason as checkin-core.js:
 * the Cloudflare adapter's bundler cannot resolve a `node:` import. That makes
 * the check async.
 */

const encoder = new TextEncoder();

/**
 * Constant-time secret comparison.
 *
 * Both sides are hashed first so the comparison is always over 32 bytes: a
 * length-sensitive comparison would leak the secret's length.
 *
 * @param {unknown} provided
 * @param {unknown} expected
 * @returns {Promise<boolean>} false when either side is missing or empty
 */
export async function secretMatches(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string")
    return false;
  if (!provided || !expected) return false;

  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * @param {string} value
 * @returns {Promise<Uint8Array>}
 */
async function sha256(value) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value))
  );
}
