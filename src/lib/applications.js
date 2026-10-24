/**
 * When the club is accepting new applications.
 *
 * Stored as one site_settings row so the board can open and close intake for
 * a recruitment drive without a deploy. Pure functions, no I/O, so the rules
 * are testable: see scripts/selfcheck.mjs.
 */

/**
 * @typedef {Object} ApplicationWindow
 * @property {string | null} opens_at  ISO timestamp, or null for "no start"
 * @property {string | null} closes_at ISO timestamp, or null for "no end"
 */

/** Neither end set: intake is always open, which is how the club started. */
export const ALWAYS_OPEN = { opens_at: null, closes_at: null };

/**
 * Accepts whatever is in the settings row, including nothing at all.
 *
 * @param {unknown} value
 * @returns {ApplicationWindow}
 */
export function resolveWindow(value) {
  const v =
    value && typeof value === "object" ? /** @type {any} */ (value) : {};
  const clean = (x) => {
    if (typeof x !== "string" || !x.trim()) return null;
    const t = Date.parse(x);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  };
  return { opens_at: clean(v.opens_at), closes_at: clean(v.closes_at) };
}

/**
 * @typedef {Object} WindowState
 * @property {'always'|'before'|'open'|'after'} state
 * @property {boolean} accepting   whether an application may be submitted now
 * @property {string | null} opensAt
 * @property {string | null} closesAt
 * @property {number | null} msUntilOpen   only when state is 'before'
 * @property {number | null} msUntilClose  only when state is 'open' and an end is set
 */

/**
 * @param {ApplicationWindow} win
 * @param {number} nowMs
 * @returns {WindowState}
 */
export function windowState(win, nowMs) {
  const { opens_at, closes_at } = resolveWindow(win);
  const opens = opens_at ? Date.parse(opens_at) : null;
  const closes = closes_at ? Date.parse(closes_at) : null;

  const base = {
    opensAt: opens_at,
    closesAt: closes_at,
    msUntilOpen: null,
    msUntilClose: null,
  };

  if (opens !== null && nowMs < opens) {
    return {
      ...base,
      state: "before",
      accepting: false,
      msUntilOpen: opens - nowMs,
    };
  }
  // An end that has passed closes intake whether or not a start was set.
  if (closes !== null && nowMs >= closes) {
    return { ...base, state: "after", accepting: false };
  }
  if (opens === null && closes === null) {
    return { ...base, state: "always", accepting: true };
  }
  return {
    ...base,
    state: "open",
    accepting: true,
    msUntilClose: closes === null ? null : closes - nowMs,
  };
}

/**
 * "2 days, 4 hours" - coarse on purpose. A to-the-second countdown belongs in
 * the browser, where it can tick; this is for the server-rendered copy and for
 * anything that has to read well in an email.
 *
 * @param {number} ms
 */
export function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "moments";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  // Minutes are noise next to days, and the only useful unit under an hour.
  if (!days && minutes)
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  return parts.slice(0, 2).join(" and ") || "under a minute";
}

/**
 * Splits a duration for a ticking display.
 *
 * @param {number} ms
 */
export function countdownParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
