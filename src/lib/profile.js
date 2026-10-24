// @ts-nocheck
/**
 * What a complete member profile needs before the site opens up.
 *
 * Kept next to roles.js but separate from it: this is about whether we know
 * who somebody is, not what they are allowed to do.
 *
 * @typedef {{
 *   full_name?: string | null,
 *   university?: string | null,
 *   field?: string | null,
 *   year?: string | null,
 *   bio?: string | null,
 *   onboarded_at?: string | null
 * }} ProfileLike
 */

/**
 * Required on every profile, whatever the role. The club runs on knowing who
 * is in the room, so an account with blanks is not usable.
 */
export const REQUIRED_PROFILE_FIELDS = [
	{ key: 'full_name', label: 'Full name', min: 3 },
	{ key: 'university', label: 'University' },
	{ key: 'field', label: 'Field of study' },
	{ key: 'year', label: 'Year' },
	{ key: 'bio', label: 'Why you joined', min: 10 }
];

/**
 * Which required fields are still blank.
 * @param {ProfileLike | null | undefined} profile
 * @returns {{key: string, label: string}[]}
 */
export function missingProfileFields(profile) {
	if (!profile) return REQUIRED_PROFILE_FIELDS.map(({ key, label }) => ({ key, label }));
	return REQUIRED_PROFILE_FIELDS.filter((f) => {
		const value = /** @type {Record<string, unknown>} */ (profile)[f.key];
		if (typeof value !== 'string') return true;
		return value.trim().length < (f.min ?? 1);
	}).map(({ key, label }) => ({ key, label }));
}

/**
 * True when nothing is missing and onboarding was actually submitted.
 *
 * Both halves matter: a row created by the signup trigger has blanks AND no
 * onboarded_at, while somebody who filled the form before a field became
 * required has onboarded_at but blanks.
 *
 * @param {ProfileLike | null | undefined} profile
 */
export function profileComplete(profile) {
	if (!profile) return false;
	if (!profile.onboarded_at) return false;
	return missingProfileFields(profile).length === 0;
}

/**
 * Turns what somebody typed into a link into something safe to follow.
 *
 * The fields ask for "github.com/you", so most people leave the scheme off.
 * A bare "github.com/you" in an href is a RELATIVE path: the browser hangs it
 * off the current page and you land on club.codiha.com/members/github.com/you,
 * which is nothing. Assume https for those.
 *
 * Anything that is already a URL with a scheme has to be one we are willing
 * to put behind a link somebody else will click, so only http and https pass.
 * "javascript:..." in a profile field would otherwise run on the profile page
 * of whoever viewed it.
 *
 * @param {string | null | undefined} raw
 * @returns {string | null} an absolute http(s) URL, or null if there is none
 */
export function externalUrl(raw) {
	const value = String(raw ?? '').trim();
	if (!value) return null;

	// A scheme is anything up to the first colon that looks like a scheme;
	// "github.com/you" has no colon, "localhost:3000/x" is not a scheme.
	const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
	const candidate = scheme ? value : `https://${value}`;
	if (scheme && scheme !== 'http' && scheme !== 'https') return null;

	try {
		const url = new URL(candidate);
		// A URL needs somewhere to go: "https://" alone parses but is useless,
		// and so is anything whose host we could not read.
		if (!url.hostname || !url.hostname.includes('.')) return null;
		return url.href;
	} catch {
		return null;
	}
}
