/**
 * The career settings on the Portfolio Site editor's design form: how many
 * years back a role still prints in full, and how many of a role's
 * achievements print before a "show more". Both layouts have them; see
 * `careerDetail` in $lib/portfolio-themes.
 *
 * Out of the route so it can be tested, for the reason portfolio-theme-form.ts
 * gives.
 */

import {
	ACHIEVEMENTS_PER_ROLE_OPTIONS,
	BRIEF_ROLES_AFTER_YEARS_OPTIONS,
	DEFAULT_ACHIEVEMENTS_PER_ROLE,
	DEFAULT_BRIEF_ROLES_AFTER_YEARS,
	type PortfolioThemeConfig
} from '$lib/portfolio-themes';

/** A select's value as the option it names, or null when it names none of them. */
function option<T extends number | string>(raw: FormDataEntryValue | null, options: readonly T[]) {
	const text = String(raw ?? '');
	return options.find((o) => String(o) === text) ?? null;
}

/**
 * Read both settings from the form into `next`.
 *
 * A value equal to the default is not stored, as a palette colour equal to the
 * layout's is not: storing it would pin today's default into the row. A form
 * without the fields leaves what is stored alone, and so does a value that is
 * not one of the choices, which only a hand-made request can send.
 */
export function applyCareerFields(next: PortfolioThemeConfig, form: FormData): void {
	if (form.has('briefRolesAfterYears')) {
		const years = option(form.get('briefRolesAfterYears'), BRIEF_ROLES_AFTER_YEARS_OPTIONS);
		if (years === DEFAULT_BRIEF_ROLES_AFTER_YEARS) delete next.briefRolesAfterYears;
		else if (years !== null) next.briefRolesAfterYears = years;
	}
	if (form.has('achievementsPerRole')) {
		const count = option(form.get('achievementsPerRole'), ACHIEVEMENTS_PER_ROLE_OPTIONS);
		if (count === DEFAULT_ACHIEVEMENTS_PER_ROLE) delete next.achievementsPerRole;
		else if (count !== null) next.achievementsPerRole = count;
	}
}
