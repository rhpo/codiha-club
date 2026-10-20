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
