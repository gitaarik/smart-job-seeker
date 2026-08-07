/**
 * Registry of contact fields a resume version may hide.
 *
 * Contact details live as scalar columns on the `profiles` table, so — unlike
 * work experiences or skills, which are rows carrying their own `tags` — they
 * can't be tagged per-version. Instead a version stores per-field visibility as
 * `hide:<key>` tokens in its `toggles` array (aggregated across the extension
 * chain by createProfileFilter, see profile-filter.ts).
 *
 * Contact fields default to VISIBLE: a token only ever *removes* one, so
 * existing versions are unaffected and only a version that opts out loses a
 * field. (The `nationality` toggle works the opposite, opt-in, way — it is not
 * a `hide:` token and is left untouched here.)
 *
 * This list is the single source of truth for which contact fields are
 * togglable plus their labels; both resume templates (ProfileDisplay and
 * StructuredResume) and the version editor derive from it. Keys are stable
 * identifiers deliberately decoupled from DB column names — rename a column and
 * only the accessor in the template moves, the stored tokens keep working.
 *
 * The `hide:` prefix is reserved exclusively for contact visibility, which is
 * what makes save-time cleanup possible: buildToggles() re-derives every
 * `hide:*` token from this registry, so a token for a field that was later
 * removed simply isn't regenerated.
 */
export interface ContactFieldDef {
	key: string;
	label: string;
}

export const CONTACT_FIELDS: ContactFieldDef[] = [
	{ key: 'email', label: 'Email' },
	{ key: 'phone', label: 'Phone' },
	{ key: 'location', label: 'Location' },
	{ key: 'website', label: 'Website' },
	{ key: 'linkedin', label: 'LinkedIn' },
	{ key: 'github', label: 'GitHub' }
];

/**
 * Whether a contact field is hidden, given a version's aggregated toggles.
 */
export function isContactHidden(key: string, toggles: string[] | unknown): boolean {
	return Array.isArray(toggles) && toggles.includes(`hide:${key}`);
}

/**
 * Build the `toggles` array to persist for a version, given the contact keys
 * the user wants VISIBLE. Contact `hide:*` tokens are regenerated fresh from
 * the registry, so any token for a removed/renamed field is dropped
 * automatically (self-cleaning). Non-contact toggles (e.g. "nationality") are
 * preserved untouched.
 */
export function buildToggles(
	visibleContactKeys: Iterable<string>,
	existingToggles: string[] | unknown
): string[] {
	const visible = new Set(visibleContactKeys);
	// Keep everything that isn't a contact hide-token; the `hide:` prefix is ours
	// alone, so dropping all of them here also garbage-collects orphans.
	const preserved = (Array.isArray(existingToggles) ? existingToggles : []).filter(
		(t): t is string => typeof t === 'string' && !t.startsWith('hide:')
	);
	const hidden = CONTACT_FIELDS.filter((f) => !visible.has(f.key)).map((f) => `hide:${f.key}`);
	return [...preserved, ...hidden];
}
