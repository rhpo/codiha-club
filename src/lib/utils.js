// @ts-nocheck
/** Shared formatting helpers. Dates are rendered in the visitor's locale. */

export function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "in 3 days" / "2 hours ago" */
export function relative(iso) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) {
      const n = Math.round(diff / ms);
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        n,
        unit
      );
    }
  }
  return "just now";
}

/** Compact range: "12 Mar 2026, 14:00 → 18:00" or across days. */
export function dateRange(startIso, endIso) {
  if (!startIso) return "-";
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  if (!e) return formatDateTime(startIso);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${formatDate(startIso)}, ${formatTime(startIso)} → ${formatTime(endIso)}`
    : `${formatDateTime(startIso)} → ${formatDateTime(endIso)}`;
}

/**
 * ISO timestamp → value for <input type="datetime-local">, in the *viewer's*
 * timezone. During SSR this uses the server clock; hydration corrects it.
 * ponytail: good enough. The form posts the browser's tz offset back so the
 * saved value is always right.
 */
export function toDateTimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function isPast(iso) {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export function isLive(startIso, endIso) {
  const now = Date.now();
  return (
    new Date(startIso).getTime() <= now && now <= new Date(endIso).getTime()
  );
}

export function initials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(s) {
  return (
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      // strip combining diacritics (U+0300–U+036F)
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
  );
}

export const PLACE_LABEL = {
  1: "🥇 1st place",
  2: "🥈 2nd place",
  3: "🥉 3rd place",
};

export const UNIVERSITIES = [
  "ESST d'Alger",
  "USTHB",
  "ESI (ESI Alger)",
  "ESI SBA",
  "Université Alger 1",
  "Université de Blida",
  "Université de Boumerdès",
  "ENP (École Nationale Polytechnique)",
  "ENSIA",
  "INI",
  // No 'Other' entry: it is a prompt to type a real name, handled by the
  // onboarding form, so nobody is stored as literally 'Other'.
];

export const FIELDS = [
  "Computer Science",
  "Software Engineering",
  "Artificial Intelligence",
  "Cybersecurity",
  "Data Science",
  "Networks & Telecom",
  "Electronics / Embedded",
  "Mathematics",
  "Design / UX",
  "Business / Management",
  "Other",
];

export const YEARS = [
  "L1",
  "L2",
  "L3",
  "M1",
  "M2",
  "PhD",
  "Engineering 1",
  "Engineering 2",
  "Engineering 3",
  "Graduate",
];
