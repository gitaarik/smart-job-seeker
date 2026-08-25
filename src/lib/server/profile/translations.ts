/**
 * Server-side translation resolver + tree applier for multi-language exports.
 *
 * `loadTranslator` bulk-loads a profile's overlays for one locale into a Map
 * (single query; the base language skips the DB entirely). `applyTranslations`
 * walks a loaded profile tree and overwrites the translatable fields in place —
 * so the Svelte render components need no changes: they just render whatever
 * string the field holds.
 *
 * See resume-translations.ts for the translatable-field vocabulary.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import {
	education,
	languages,
	profile_translations,
	side_project_achievements,
	side_projects,
	tech_skill_categories,
	work_experience_achievements,
	work_experience_projects,
	work_experiences
} from '$lib/server/db/schema';
import {
	BASE_LOCALE,
	fieldsForEntity,
	type TranslatableGroup,
	type TranslatableRow,
	translationKey
} from '$lib/resume-translations';
import { localizeLanguageName } from '$lib/resume-template-labels';

export interface Translator {
	locale: string;
	isBase: boolean;
	/** Overlay for (entity, id, field), or `base` when untranslated. */
	t: (entity: string, id: number | string, field: string, base: string | null) => string | null;
}

const IDENTITY: Translator = {
	locale: BASE_LOCALE,
	isBase: true,
	t: (_entity, _id, _field, base) => base
};

/**
 * Load every translation for a profile in `locale` into an in-memory resolver.
 * One query; English/empty locale returns the identity resolver (no DB hit).
 */
export async function loadTranslator(
	profileId: number,
	locale: string | null | undefined
): Promise<Translator> {
	if (!locale || locale === BASE_LOCALE) return IDENTITY;

	const rows = await db
		.select({
			entity_type: profile_translations.entity_type,
			entity_id: profile_translations.entity_id,
			field: profile_translations.field,
			value: profile_translations.value
		})
		.from(profile_translations)
		.where(
			and(eq(profile_translations.profile_id, profileId), eq(profile_translations.locale, locale))
		);

	const map = new Map<string, string>();
	for (const r of rows) {
		map.set(translationKey(r.entity_type, r.entity_id, r.field), r.value);
	}

	return {
		locale,
		isBase: false,
		t: (entity, id, field, base) => map.get(translationKey(entity, id, field)) ?? base
	};
}

/** Overwrite one field on a row when an overlay exists (no-op for the base). */
function overlay(
	tr: Translator,
	entity: string,
	row: Record<string, any> | null | undefined,
	field: string
): void {
	if (!row || row.id == null) return;
	row[field] = tr.t(entity, row.id, field, row[field] ?? null);
}

/**
 * Apply the locale's overlays to a loaded profile tree, mutating it in place.
 * The entity/field pairs mirror TRANSLATABLE_FIELDS in resume-translations.ts.
 */
export function applyTranslations(
	profile: Record<string, any> | null | undefined,
	tr: Translator
): typeof profile {
	if (tr.isBase || !profile) return profile;

	// Profile-level fields key on the profile id itself.
	for (const f of ['summary', 'headline', 'subtitle', 'title', 'about_me_text', 'location']) {
		profile[f] = tr.t('profile', profile.id, f, profile[f] ?? null);
	}

	for (const we of profile.work_experiences ?? []) {
		for (const f of ['position', 'headline', 'summary', 'description']) {
			overlay(tr, 'work_experience', we, f);
		}
		for (const a of we.work_experience_achievements ?? []) {
			overlay(tr, 'work_experience_achievement', a, 'description');
		}
		for (const p of we.work_experience_projects ?? []) {
			for (const f of ['name', 'description', 'outcome']) {
				overlay(tr, 'work_experience_project', p, f);
			}
		}
	}

	for (const cat of profile.tech_skill_categories ?? []) {
		overlay(tr, 'tech_skill_category', cat, 'name');
	}

	for (const edu of profile.educations ?? []) {
		for (const f of ['area', 'study_type', 'summary']) {
			overlay(tr, 'education', edu, f);
		}
	}

	for (const sp of profile.side_projects ?? []) {
		for (const f of ['name', 'summary']) {
			overlay(tr, 'side_project', sp, f);
		}
		for (const a of sp.side_project_achievements ?? []) {
			overlay(tr, 'side_project_achievement', a, 'description');
		}
	}

	// A language's name has a second source: ICU knows "English" in every
	// locale, so a row without an overlay is still localized — from its ISO
	// code, or failing that its English name. An overlay row wins.
	for (const lang of profile.languages ?? []) {
		if (!lang || lang.id == null) continue;
		lang.name =
			tr.t('language', lang.id, 'name', null) ??
			localizeLanguageName(lang.name, lang.language_code, tr.locale);
	}

	return profile;
}

/**
 * Verify a (entity_type, entity_id) tuple belongs to `profileId`. Translation
 * writes are keyed by entity id supplied by the client, so every write MUST
 * confirm ownership first — otherwise one user could overwrite another's
 * translation (the overlay rows are read back per profile at render time).
 * Returns false for unknown entity types.
 */
export async function isEntityOwned(
	entity: string,
	id: number,
	profileId: number
): Promise<boolean> {
	switch (entity) {
		case 'profile':
			return id === profileId;
		case 'work_experience':
			return (
				(
					await db
						.select({ id: work_experiences.id })
						.from(work_experiences)
						.where(and(eq(work_experiences.id, id), eq(work_experiences.profile_id, profileId)))
						.limit(1)
				).length > 0
			);
		case 'tech_skill_category':
			return (
				(
					await db
						.select({ id: tech_skill_categories.id })
						.from(tech_skill_categories)
						.where(
							and(eq(tech_skill_categories.id, id), eq(tech_skill_categories.profile_id, profileId))
						)
						.limit(1)
				).length > 0
			);
		case 'education':
			return (
				(
					await db
						.select({ id: education.id })
						.from(education)
						.where(and(eq(education.id, id), eq(education.profile_id, profileId)))
						.limit(1)
				).length > 0
			);
		case 'side_project':
			return (
				(
					await db
						.select({ id: side_projects.id })
						.from(side_projects)
						.where(and(eq(side_projects.id, id), eq(side_projects.profile_id, profileId)))
						.limit(1)
				).length > 0
			);
		case 'work_experience_achievement':
			return (
				(
					await db
						.select({ id: work_experience_achievements.id })
						.from(work_experience_achievements)
						.innerJoin(
							work_experiences,
							eq(work_experience_achievements.work_experience_id, work_experiences.id)
						)
						.where(
							and(
								eq(work_experience_achievements.id, id),
								eq(work_experiences.profile_id, profileId)
							)
						)
						.limit(1)
				).length > 0
			);
		case 'work_experience_project':
			return (
				(
					await db
						.select({ id: work_experience_projects.id })
						.from(work_experience_projects)
						.innerJoin(
							work_experiences,
							eq(work_experience_projects.work_experience_id, work_experiences.id)
						)
						.where(
							and(eq(work_experience_projects.id, id), eq(work_experiences.profile_id, profileId))
						)
						.limit(1)
				).length > 0
			);
		case 'side_project_achievement':
			return (
				(
					await db
						.select({ id: side_project_achievements.id })
						.from(side_project_achievements)
						.innerJoin(
							side_projects,
							eq(side_project_achievements.side_project_id, side_projects.id)
						)
						.where(
							and(eq(side_project_achievements.id, id), eq(side_projects.profile_id, profileId))
						)
						.limit(1)
				).length > 0
			);
		case 'language':
			return (
				(
					await db
						.select({ id: languages.id })
						.from(languages)
						.where(and(eq(languages.id, id), eq(languages.profile_id, profileId)))
						.limit(1)
				).length > 0
			);
		default:
			return false;
	}
}

/**
 * Batch variant of {@link isEntityOwned}: the set of owned entity ids per type
 * for a profile (one query per entity type, independent of how many rows are being saved).
 * Used by the overview page which writes many fields at once.
 */
export async function loadOwnedEntityIds(profileId: number): Promise<Record<string, Set<number>>> {
	const [we, wea, wep, cats, edu, sp, spa, langs] = await Promise.all([
		db
			.select({ id: work_experiences.id })
			.from(work_experiences)
			.where(eq(work_experiences.profile_id, profileId)),
		db
			.select({ id: work_experience_achievements.id })
			.from(work_experience_achievements)
			.innerJoin(
				work_experiences,
				eq(work_experience_achievements.work_experience_id, work_experiences.id)
			)
			.where(eq(work_experiences.profile_id, profileId)),
		db
			.select({ id: work_experience_projects.id })
			.from(work_experience_projects)
			.innerJoin(
				work_experiences,
				eq(work_experience_projects.work_experience_id, work_experiences.id)
			)
			.where(eq(work_experiences.profile_id, profileId)),
		db
			.select({ id: tech_skill_categories.id })
			.from(tech_skill_categories)
			.where(eq(tech_skill_categories.profile_id, profileId)),
		db.select({ id: education.id }).from(education).where(eq(education.profile_id, profileId)),
		db
			.select({ id: side_projects.id })
			.from(side_projects)
			.where(eq(side_projects.profile_id, profileId)),
		db
			.select({ id: side_project_achievements.id })
			.from(side_project_achievements)
			.innerJoin(side_projects, eq(side_project_achievements.side_project_id, side_projects.id))
			.where(eq(side_projects.profile_id, profileId)),
		db.select({ id: languages.id }).from(languages).where(eq(languages.profile_id, profileId))
	]);
	return {
		profile: new Set([profileId]),
		work_experience: new Set(we.map((r) => r.id)),
		work_experience_achievement: new Set(wea.map((r) => r.id)),
		work_experience_project: new Set(wep.map((r) => r.id)),
		tech_skill_category: new Set(cats.map((r) => r.id)),
		education: new Set(edu.map((r) => r.id)),
		side_project: new Set(sp.map((r) => r.id)),
		side_project_achievement: new Set(spa.map((r) => r.id)),
		language: new Set(langs.map((r) => r.id))
	};
}

/** Longer fields get a textarea in the editor; the rest a single-line input. */
const MULTILINE_FIELDS = new Set(['summary', 'description', 'outcome', 'note', 'about_me_text']);

/** Append a registered entity's non-empty fields as editor rows. */
function pushRows(
	rows: TranslatableRow[],
	entity: string,
	id: number,
	obj: Record<string, any>,
	labelPrefix = ''
): void {
	for (const f of fieldsForEntity(entity)) {
		const base = (obj?.[f.field] ?? '').toString();
		if (!base.trim()) continue;
		rows.push({
			entity,
			id,
			field: f.field,
			label: labelPrefix ? `${labelPrefix} — ${f.label}` : f.label,
			base,
			multiline: MULTILINE_FIELDS.has(f.field)
		});
	}
}

/**
 * Walk a loaded profile tree and collect every translatable field that has a
 * non-empty English base, grouped for the editor UI. Same tree shape as
 * applyTranslations; only fields with real content are surfaced.
 */
export function collectTranslatable(
	profile: Record<string, any> | null | undefined
): TranslatableGroup[] {
	const groups: TranslatableGroup[] = [];
	if (!profile) return groups;

	const profileRows: TranslatableRow[] = [];
	pushRows(profileRows, 'profile', profile.id, profile);
	if (profileRows.length) {
		groups.push({ key: 'profile', title: 'Profile', rows: profileRows });
	}

	for (const we of profile.work_experiences ?? []) {
		const rows: TranslatableRow[] = [];
		pushRows(rows, 'work_experience', we.id, we);
		(we.work_experience_achievements ?? []).forEach((a: any, i: number) => {
			const base = (a?.description ?? '').toString();
			if (!base.trim()) return;
			rows.push({
				entity: 'work_experience_achievement',
				id: a.id,
				field: 'description',
				label: `Achievement ${i + 1}`,
				base,
				multiline: true
			});
		});
		const projects: Array<Record<string, unknown>> = we.work_experience_projects ?? [];
		projects.forEach((p, i) => {
			const name = typeof p.name === 'string' ? p.name.trim() : '';
			pushRows(rows, 'work_experience_project', Number(p.id), p, name || `Project ${i + 1}`);
		});
		if (rows.length) {
			groups.push({
				key: `we-${we.id}`,
				title: `Work experience — ${we.name || we.position || ''}`.trim(),
				rows
			});
		}
	}

	const skillRows: TranslatableRow[] = [];
	for (const cat of profile.tech_skill_categories ?? []) {
		pushRows(skillRows, 'tech_skill_category', cat.id, cat, cat.name || 'Category');
	}
	if (skillRows.length) {
		groups.push({ key: 'skills', title: 'Skill categories', rows: skillRows });
	}

	for (const edu of profile.educations ?? []) {
		const rows: TranslatableRow[] = [];
		pushRows(rows, 'education', edu.id, edu);
		if (rows.length) {
			groups.push({
				key: `edu-${edu.id}`,
				title: `Education — ${edu.institution || ''}`.trim(),
				rows
			});
		}
	}

	for (const sp of profile.side_projects ?? []) {
		const rows: TranslatableRow[] = [];
		pushRows(rows, 'side_project', sp.id, sp);
		(sp.side_project_achievements ?? []).forEach((a: any, i: number) => {
			const base = (a?.description ?? '').toString();
			if (!base.trim()) return;
			rows.push({
				entity: 'side_project_achievement',
				id: a.id,
				field: 'description',
				label: `Achievement ${i + 1}`,
				base,
				multiline: true
			});
		});
		if (rows.length) {
			groups.push({
				key: `sp-${sp.id}`,
				title: `Project — ${sp.name || ''}`.trim(),
				rows
			});
		}
	}

	const languageRows: TranslatableRow[] = [];
	for (const lang of profile.languages ?? []) {
		pushRows(languageRows, 'language', lang.id, lang, lang.name || 'Language');
	}
	if (languageRows.length) {
		groups.push({ key: 'languages', title: 'Languages', rows: languageRows });
	}

	return groups;
}
