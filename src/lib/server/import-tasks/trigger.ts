/**
 * Type-light entry point for firing an auto-import reconcile from request
 * handlers.
 *
 * Why this exists: `reconcile.ts` pulls a large type graph (the full relational
 * schema + the suggester route module). Importing it directly into an
 * already-heavy route file — one with several drizzle relational (`with: {...}`)
 * queries — tips TypeScript past its type-instantiation threshold there and
 * degrades drizzle's relational-query typing into spurious errors. This shim's
 * public surface is trivial (a `(number, opts) => void` function), so importers
 * pull none of that graph; the real module is loaded lazily inside.
 */
export function triggerAutoImportReconcile(
	profileId: number,
	opts: { force?: boolean; skipTopUp?: boolean } = {}
): void {
	void import('./reconcile')
		.then((m) => m.triggerAutoImportReconcile(profileId, opts))
		.catch((err) =>
			console.error(`[auto-import] reconcile trigger failed for profile ${profileId}:`, err)
		);
}
