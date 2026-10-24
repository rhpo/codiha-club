/**
 * The reactions a member can leave on a post.
 *
 * A fixed set, not free text: the column is constrained to these keys, the
 * UI only has buttons for these, and storing the key rather than the glyph
 * means the emoji can be changed later without rewriting rows.
 */
export const REACTIONS = [
	{ key: 'like', glyph: '👍', label: 'Nice' },
	{ key: 'love', glyph: '❤️', label: 'Love it' },
	{ key: 'fire', glyph: '🔥', label: 'Fire' },
	{ key: 'clap', glyph: '👏', label: 'Respect' },
	{ key: 'idea', glyph: '💡', label: 'Clever' },
	{ key: 'funny', glyph: '😄', label: 'Funny' }
];

export const REACTION_KEYS = REACTIONS.map((r) => r.key);

/** @param {string} key */
export function glyphFor(key) {
	return REACTIONS.find((r) => r.key === key)?.glyph ?? '👍';
}

/**
 * Turns the tallied rows into per-post counts, highest first.
 *
 * @param {Array<{post_id: string, emoji: string, n: number}>} rows
 * @returns {Map<string, Array<{key: string, glyph: string, n: number}>>}
 */
export function tallyReactions(rows) {
	/** @type {Map<string, Array<{key: string, glyph: string, n: number}>>} */
	const byPost = new Map();

	for (const row of rows ?? []) {
		// A key that is no longer offered still has rows in the table, so it is
		// kept rather than dropped: the count would otherwise be wrong.
		const entry = { key: row.emoji, glyph: glyphFor(row.emoji), n: Number(row.n ?? 0) };
		const list = byPost.get(row.post_id) ?? [];
		list.push(entry);
		byPost.set(row.post_id, list);
	}

	for (const list of byPost.values()) {
		list.sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
	}

	return byPost;
}

/** Total across every reaction on a post. */
export function totalReactions(list) {
	return (list ?? []).reduce((sum, r) => sum + Number(r.n ?? 0), 0);
}
