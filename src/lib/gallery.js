/**
 * Turning a flat list of gallery rows into the sections the page renders.
 *
 * Pure, so the ordering rules are testable: see scripts/selfcheck.mjs.
 */

/**
 * Groups by section, keeping both the photos and the sections themselves in
 * the order the board arranged them.
 *
 * A section sorts by the lowest position in it, so moving one photo to the
 * top moves its whole section up. That is what somebody dragging a photo
 * around actually expects, and it avoids a second "section order" column
 * that would have to be kept in step.
 *
 * @param {Array<{id: string, url: string, caption?: string|null, section?: string|null, position?: number|null, kind?: string}>} items
 */
export function groupGallery(items) {
  /** @type {Map<string, {title: string, items: any[], rank: number}>} */
  const bySection = new Map();

  for (const item of items ?? []) {
    const title = String(item.section ?? "").trim();
    const position = Number(item.position ?? 0);
    const existing = bySection.get(title);
    if (existing) {
      existing.items.push(item);
      existing.rank = Math.min(existing.rank, position);
    } else {
      bySection.set(title, { title, items: [item], rank: position });
    }
  }

  for (const section of bySection.values()) {
    section.items.sort(
      (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)
    );
  }

  return [...bySection.values()]
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
    .map(({ title, items: list }) => ({ title, items: list }));
}

/** Videos need a <video>, everything else an <img>. */
export function isVideo(item) {
  if (item?.kind === "video") return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(String(item?.url ?? ""));
}
