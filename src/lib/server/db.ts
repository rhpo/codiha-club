/**
 * Public, read-only pages should degrade to "nothing to show" rather than a
 * 500 when Postgres hiccups. Member and admin pages deliberately do NOT use
 * this: there, a failed read must be loud.
 */
export function safe<T>(p: PromiseLike<T>): Promise<T | { data: null; count: null; error: unknown }> {
	return Promise.resolve(p).then(
		(r) => r,
		(error) => ({ data: null, count: null, error })
	);
}
