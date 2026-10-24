/**
 * The visitor's chosen colour scheme on a showcase site.
 *
 * Kept in localStorage, one key for every showcase on this origin: it is a
 * reading preference, not a property of whose site it is. Every access is
 * guarded, because storage throws in some private windows and is empty in
 * others, and the site must render the same either way.
 */

export type SchemePreference = 'auto' | 'light' | 'dark';

const KEY = 'sjs-portfolio-scheme';

function isPreference(value: unknown): value is SchemePreference {
	return value === 'auto' || value === 'light' || value === 'dark';
}

export function loadSchemePreference(): SchemePreference | null {
	try {
		const value = localStorage.getItem(KEY);
		return isPreference(value) ? value : null;
	} catch {
		return null;
	}
}

export function saveSchemePreference(value: SchemePreference): void {
	try {
		localStorage.setItem(KEY, value);
	} catch {
		// Not remembered; the switch still works for this visit.
	}
}
