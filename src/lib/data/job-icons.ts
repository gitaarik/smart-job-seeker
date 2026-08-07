/**
 * Icon and color mappings for job taxonomy categories.
 * Maps canonical values from job-taxonomy.ts to Font Awesome icons.
 *
 * Client-side only — keep separate from format.ts which is also used server-side.
 */

import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import {
	faBriefcase,
	faHourglass,
	faFileContract,
	faGraduationCap,
	faHouseLaptop,
	faBuilding,
	faCity,
	faSeedling,
	faLayerGroup,
	faUserTie,
	faSitemap,
	faCrown,
	faChessKing,
	faChessQueen,
	faStar
} from '@fortawesome/free-solid-svg-icons';
import {
	JOB_TYPES,
	WORK_LOCATIONS,
	EXPERIENCE_LEVELS,
	buildNormalizeMap,
	type TaxonomyCategory
} from './job-taxonomy';

// ---------------------------------------------------------------------------
// Icon maps — keyed by canonical value
// ---------------------------------------------------------------------------

const JOB_TYPE_ICONS: Record<string, IconDefinition> = {
	full_time: faBriefcase,
	part_time: faHourglass,
	contract: faFileContract,
	internship: faGraduationCap
};

const WORK_LOCATION_ICONS: Record<string, IconDefinition> = {
	remote: faHouseLaptop,
	hybrid: faBuilding,
	onsite: faCity
};

const EXPERIENCE_LEVEL_ICONS: Record<string, IconDefinition> = {
	entry: faSeedling,
	junior: faSeedling,
	mid: faLayerGroup,
	mid_senior: faLayerGroup,
	senior: faUserTie,
	lead: faSitemap,
	principal: faCrown,
	staff: faChessQueen,
	director: faChessKing,
	executive: faStar,
	internship: faGraduationCap
};

// ---------------------------------------------------------------------------
// Color classes — keyed by category
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<string, string> = {
	job_type: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
	work_location:
		'border-[var(--dash-primary)]/20 bg-[var(--dash-primary-light)] text-[var(--dash-primary)]',
	experience_level: 'border-purple-500/20 bg-purple-500/10 text-purple-700'
};

// ---------------------------------------------------------------------------
// Normalization — resolve raw strings to canonical values
// ---------------------------------------------------------------------------

const normMaps: Record<string, Map<string, string>> = {
	job_type: buildNormalizeMap(JOB_TYPES),
	work_location: buildNormalizeMap(WORK_LOCATIONS),
	experience_level: buildNormalizeMap(EXPERIENCE_LEVELS)
};

const categories: Record<string, TaxonomyCategory> = {
	job_type: JOB_TYPES,
	work_location: WORK_LOCATIONS,
	experience_level: EXPERIENCE_LEVELS
};

const iconMaps: Record<string, Record<string, IconDefinition>> = {
	job_type: JOB_TYPE_ICONS,
	work_location: WORK_LOCATION_ICONS,
	experience_level: EXPERIENCE_LEVEL_ICONS
};

/**
 * Resolve a raw value to its canonical form via taxonomy alias/pattern matching.
 */
export function normalize(category: string, raw: string): string {
	const lower = raw.toLowerCase();
	const normMap = normMaps[category];
	if (normMap) {
		const canonical = normMap.get(lower);
		if (canonical) return canonical;
	}
	// Pattern matching (e.g. "Hybrid (up to 3 remote days p/w)" → hybrid)
	const cat = categories[category];
	if (cat) {
		for (const val of cat.values) {
			for (const p of val.patterns ?? []) {
				if (p.mode === 'includes' && lower.includes(p.pattern)) return val.canonical;
				if (p.mode === 'startsWith' && lower.startsWith(p.pattern)) return val.canonical;
			}
		}
	}
	return lower;
}

/**
 * Get the icon for a raw value in a category.
 */
export function getIcon(category: string, raw: string): IconDefinition | undefined {
	const icons = iconMaps[category];
	if (!icons) return undefined;
	const canonical = normalize(category, raw);
	return icons[canonical];
}

/**
 * Get all canonical icons for a category (for style guide display).
 */
export function getAllIcons(category: string): { value: string; icon: IconDefinition }[] {
	const icons = iconMaps[category];
	if (!icons) return [];
	return Object.entries(icons).map(([value, icon]) => ({ value, icon }));
}
