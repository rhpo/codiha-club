/**
 * `<input type="datetime-local">` posts a wall-clock string with no timezone.
 * The admin forms also post `tz_offset` (`Date.prototype.getTimezoneOffset()`),
 * which is how many minutes to ADD to local time to get UTC. Combining the two
 * means an event created at 14:00 in Algiers is stored as 13:00Z regardless of
 * which timezone the server runs in.
 *
 * @param {unknown} value raw form value, e.g. "2026-03-12T14:00"
 * @param {number} tzOffsetMinutes browser offset, e.g. -60 for UTC+1
 * @returns {string | null} ISO UTC timestamp, or null when empty/unparseable
 */
export function localToUtcIso(value, tzOffsetMinutes) {
	const raw = String(value ?? '').trim();
	if (!raw) return null;

	// pad "2026-03-12T14:00" → "2026-03-12T14:00:00Z" and read it as UTC
	const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
	const ms = Date.parse(`${withSeconds}Z`);
	if (Number.isNaN(ms)) return null;

	return new Date(ms + tzOffsetMinutes * 60_000).toISOString();
}

/**
 * @param {FormData} form
 * @returns {number}
 */
export function tzOffsetFrom(form) {
	const n = Number(form.get('tz_offset'));
	// sanity bound: real offsets live within ±14h
	return Number.isFinite(n) && Math.abs(n) <= 840 ? n : 0;
}
