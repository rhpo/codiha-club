/**
 * Runtime colour palette.
 *
 * The admin picks two colours (the brand green and the accent orange); every
 * other shade in the UI, the body gradient, the translucent nav surfaces, the
 * glow around the big CTA, is derived from those two. Keeping the derivation
 * in one place means a new palette never leaves a hardcoded colour behind.
 *
 * Plain JS so scripts/selfcheck.mjs can import it without a build step.
 *
 * @typedef {{ primary: string, accent: string, text: string }} Theme
 */

/** @type {Theme} */
export const DEFAULT_THEME = {
	primary: '#294230',
	accent: '#fa9200',
	text: '#ffffff'
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Normalises `#abc` / `abc` / `#AABBCC` to `#aabbcc`.
 * @param {unknown} value
 * @returns {string | null} null when the input is not a hex colour
 */
export function normalizeHex(value) {
	if (typeof value !== 'string') return null;
	const m = value.trim().match(HEX);
	if (!m) return null;
	const h = m[1].toLowerCase();
	return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h);
}

/**
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function toRgb(hex) {
	const h = normalizeHex(hex) ?? DEFAULT_THEME.primary;
	return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/**
 * @param {string} hex
 * @returns {[number, number, number]} h in degrees, s and l in percent
 */
function toHsl(hex) {
	const [r, g, b] = toRgb(hex).map((v) => v / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return [0, 0, l * 100];
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
	else if (max === g) h = ((b - r) / d + 2) / 6;
	else h = ((r - g) / d + 4) / 6;
	return [h * 360, s * 100, l * 100];
}

/**
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {string}
 */
function hslToHex(h, s, l) {
	const sn = Math.min(100, Math.max(0, s)) / 100;
	const ln = Math.min(100, Math.max(0, l)) / 100;
	const a = sn * Math.min(ln, 1 - ln);
	/** @param {number} n */
	const f = (n) => {
		const k = (n + (((h % 360) + 360) % 360) / 30) % 12;
		const v = ln - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
		return Math.round(v * 255)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Same hue and saturation, lightness nudged by `delta` percentage points.
 * @param {string} hex
 * @param {number} delta
 */
export function shift(hex, delta) {
	const [h, s, l] = toHsl(hex);
	return hslToHex(h, s, l + delta);
}

/**
 * `"41, 66, 48"`, so opacity stays authorable in CSS as rgba(var(--x), .5).
 * @param {string} hex
 */
export function rgbChannels(hex) {
	return toRgb(hex).join(', ');
}

/**
 * Perceived luminance, 0 (black) to 1 (white).
 * @param {string} hex
 */
function luminance(hex) {
	const [r, g, b] = toRgb(hex);
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Readable text colour on top of `hex`: the dark brand shade on a light
 * background, white on a dark one.
 * @param {string} hex
 * @param {string} dark
 */
export function readableOn(hex, dark) {
	return luminance(hex) > 0.6 ? dark : '#ffffff';
}

/**
 * Anything that is not a hex colour falls back to the shipped palette, so a
 * malformed settings row can never inject arbitrary text into the CSS.
 * @param {Partial<Theme> | null | undefined | unknown} input
 * @returns {Theme}
 */
export function resolveTheme(input) {
	const o = /** @type {Partial<Theme> | null} */ (input ?? null);
	return {
		primary: normalizeHex(o?.primary) ?? DEFAULT_THEME.primary,
		accent: normalizeHex(o?.accent) ?? DEFAULT_THEME.accent,
		text: normalizeHex(o?.text) ?? DEFAULT_THEME.text
	};
}

/**
 * WCAG relative luminance, used for the contrast ratio below. Different from
 * the quick `luminance()` above, which is only a brightness guess.
 * @param {string} hex
 */
function relativeLuminance(hex) {
	const [r, g, b] = toRgb(hex)
		.map((v) => v / 255)
		.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colours, 1 (identical) to 21 (black/white).
 * Body text wants 4.5 or more.
 * @param {string} a
 * @param {string} b
 */
export function contrastRatio(a, b) {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * Every derived shade, as a flat map. Exported so the admin preview and the
 * email template reuse exactly what the site uses.
 * @param {Theme} theme
 */
export function derive(theme) {
	const primary = normalizeHex(theme?.primary) ?? DEFAULT_THEME.primary;
	const accent = normalizeHex(theme?.accent) ?? DEFAULT_THEME.accent;
	const text = normalizeHex(theme?.text) ?? DEFAULT_THEME.text;
	const light = shift(primary, 11);
	const dark = shift(primary, -7);
	const deeper = shift(primary, -14);
	return {
		light,
		primary,
		dark,
		deeper,
		accent,
		text,
		textRgb: rgbChannels(text),
		accentRgb: rgbChannels(accent),
		darkRgb: rgbChannels(dark),
		// Text sitting on an accent-coloured button: the dark brand shade reads
		// best on a bright accent, white on a dark one.
		onAccent: readableOn(accent, dark),
		/** Body text against the page background. Under 4.5 is hard to read. */
		textContrast: contrastRatio(text, primary)
	};
}

/**
 * The CSS custom-property block injected into <head> on every request.
 * Returns plain CSS text, with no <style> wrapper.
 * @param {Theme} theme
 */
export function themeCss(theme) {
	const d = derive(theme);
	// `:root:root` so the injected block outranks the defaults in base.css no
	// matter which order the browser ends up applying the stylesheets in.
	return `:root:root{
--branding-primary-light:${d.light};
--branding-primary:${d.primary};
--branding-primary-dark:${d.dark};
--branding-primary-deeper:${d.deeper};
--brand-dark-rgb:${d.darkRgb};
--accent:${d.accent};
--accent-rgb:${d.accentRgb};
--accent-soft:rgba(${d.accentRgb},0.15);
--accent-line:rgba(${d.accentRgb},0.5);
--accent-glow:rgba(${d.accentRgb},0.35);
--on-accent:${d.onAccent};
--surface-nav:rgba(${d.darkRgb},0.4);
--surface:rgba(${d.darkRgb},0.72);
--surface-strong:rgba(${d.darkRgb},0.88);
--color-text:${d.text};
--text-rgb:${d.textRgb};
--muted:rgba(${d.textRgb},0.65);
--muted-2:rgba(${d.textRgb},0.45);
--glass:rgba(${d.textRgb},0.08);
--glass-strong:rgba(${d.textRgb},0.14);
--glass-border:rgba(${d.textRgb},0.3);
--glass-border-strong:rgba(${d.textRgb},0.55);
}`;
}
