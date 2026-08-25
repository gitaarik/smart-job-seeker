/**
 * Export the per-locale translation overlay (`profile_translations`).
 *
 * The overlay is a sidecar keyed by (entity_type, entity_id, field, locale), so
 * it hangs off entity ids the export does not carry. Same treatment as
 * documents: each row records its parent's position in the exported arrays, and
 * the importer resolves those positions against the entities it recreates.
 *
 * A row whose parent no longer resolves is dropped — unlike a document, a
 * translation has no meaning detached from the field it translates. The count
 * is logged rather than swallowed.
 */

import { dbDirect } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { profile_translations } from '$lib/server/db/schema';
import type { ExportedTranslation, TranslationTarget } from './types';

/** Position of each translatable entity, keyed by database id. */
export interface TranslationIndexMaps {
	profileId: number;
	workExperience: Map<number, number>;
	workExperienceAchievement: Map<
		number,
		{ work_experience_index: number; achievement_index: number }
	>;
	sideProject: Map<number, number>;
	sideProjectAchievement: Map<number, { side_project_index: number; achievement_index: number }>;
	education: Map<number, number>;
	techSkillCategory: Map<number, number>;
	language: Map<number, number>;
}

export function emptyTranslationIndexMaps(profileId: number): TranslationIndexMaps {
	return {
		profileId,
		workExperience: new Map(),
		workExperienceAchievement: new Map(),
		sideProject: new Map(),
		sideProjectAchievement: new Map(),
		education: new Map(),
		techSkillCategory: new Map(),
		language: new Map()
	};
}

/** Turn a stored (entity_type, entity_id) pair into a positional target. */
export function resolveTranslationTarget(
	entityType: string,
	entityId: number,
	maps: TranslationIndexMaps
): TranslationTarget | null {
	switch (entityType) {
		case 'profile':
			return entityId === maps.profileId ? { kind: 'profile' } : null;

		case 'work_experience': {
			const index = maps.workExperience.get(entityId);
			return index === undefined ? null : { kind: 'work_experience', work_experience_index: index };
		}

		case 'work_experience_achievement': {
			const position = maps.workExperienceAchievement.get(entityId);
			return position ? { kind: 'work_experience_achievement', ...position } : null;
		}

		case 'side_project': {
			const index = maps.sideProject.get(entityId);
			return index === undefined ? null : { kind: 'side_project', side_project_index: index };
		}

		case 'side_project_achievement': {
			const position = maps.sideProjectAchievement.get(entityId);
			return position ? { kind: 'side_project_achievement', ...position } : null;
		}

		case 'education': {
			const index = maps.education.get(entityId);
			return index === undefined ? null : { kind: 'education', education_index: index };
		}

		case 'tech_skill_category': {
			const index = maps.techSkillCategory.get(entityId);
			return index === undefined ? null : { kind: 'tech_skill_category', category_index: index };
		}

		case 'language': {
			const index = maps.language.get(entityId);
			return index === undefined ? null : { kind: 'language', language_index: index };
		}

		default:
			return null;
	}
}

export async function buildTranslationExport(
	profileId: number,
	maps: TranslationIndexMaps
): Promise<ExportedTranslation[]> {
	const rows = await dbDirect.query.profile_translations.findMany({
		where: eq(profile_translations.profile_id, profileId),
		orderBy: [
			asc(profile_translations.locale),
			asc(profile_translations.entity_type),
			asc(profile_translations.entity_id),
			asc(profile_translations.field)
		]
	});

	const translations: ExportedTranslation[] = [];
	let orphaned = 0;

	for (const row of rows) {
		if (!row.locale || !row.field || row.value === null) continue;

		const target = resolveTranslationTarget(row.entity_type, row.entity_id, maps);
		if (!target) {
			orphaned++;
			continue;
		}

		translations.push({
			target,
			field: row.field,
			locale: row.locale,
			value: row.value
		});
	}

	if (orphaned > 0) {
		console.warn(
			`[Export] Skipped ${orphaned} translation row(s) for profile ${profileId} whose entity no longer exists`
		);
	}

	return translations;
}
