/**
 * Restore the per-locale translation overlay.
 *
 * Mirror of export-translations: positional targets resolve against the ids the
 * importer assigned. A target that doesn't resolve is skipped — a translation
 * pointing at nothing would be invisible and unreachable.
 */

import { dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profile_translations } from '$lib/server/db/schema';
import type { ExportedTranslation, TranslationTarget } from './types';

/** Ids assigned while importing profile entities, keyed by exported position. */
export interface CreatedTranslationIds {
	profileId: number;
	workExperienceIdByIndex: number[];
	/** Keyed `${workExperienceIndex}:${achievementIndex}` */
	workExperienceAchievementIdByIndex: Map<string, number>;
	sideProjectIdByIndex: number[];
	/** Keyed `${sideProjectIndex}:${achievementIndex}` */
	sideProjectAchievementIdByIndex: Map<string, number>;
	educationIdByIndex: number[];
	techSkillCategoryIdByIndex: number[];
}

export function emptyCreatedTranslationIds(profileId: number): CreatedTranslationIds {
	return {
		profileId,
		workExperienceIdByIndex: [],
		workExperienceAchievementIdByIndex: new Map(),
		sideProjectIdByIndex: [],
		sideProjectAchievementIdByIndex: new Map(),
		educationIdByIndex: [],
		techSkillCategoryIdByIndex: []
	};
}

/** Positional target back to the (entity_type, entity_id) the overlay stores. */
export function resolveTranslationEntity(
	target: TranslationTarget,
	created: CreatedTranslationIds
): { entity_type: string; entity_id: number } | null {
	if (!target) return null;

	switch (target.kind) {
		case 'profile':
			return { entity_type: 'profile', entity_id: created.profileId };

		case 'work_experience': {
			const id = created.workExperienceIdByIndex[target.work_experience_index];
			return id === undefined ? null : { entity_type: 'work_experience', entity_id: id };
		}

		case 'work_experience_achievement': {
			const key = `${target.work_experience_index}:${target.achievement_index}`;
			const id = created.workExperienceAchievementIdByIndex.get(key);
			return id === undefined
				? null
				: { entity_type: 'work_experience_achievement', entity_id: id };
		}

		case 'side_project': {
			const id = created.sideProjectIdByIndex[target.side_project_index];
			return id === undefined ? null : { entity_type: 'side_project', entity_id: id };
		}

		case 'side_project_achievement': {
			const key = `${target.side_project_index}:${target.achievement_index}`;
			const id = created.sideProjectAchievementIdByIndex.get(key);
			return id === undefined ? null : { entity_type: 'side_project_achievement', entity_id: id };
		}

		case 'education': {
			const id = created.educationIdByIndex[target.education_index];
			return id === undefined ? null : { entity_type: 'education', entity_id: id };
		}

		case 'tech_skill_category': {
			const id = created.techSkillCategoryIdByIndex[target.category_index];
			return id === undefined ? null : { entity_type: 'tech_skill_category', entity_id: id };
		}

		default:
			return null;
	}
}

/** Insert the overlay rows. Returns how many landed. */
export async function importTranslations(
	profileId: number,
	translations: ExportedTranslation[],
	created: CreatedTranslationIds
): Promise<number> {
	const now = new Date();

	const rows = translations
		.map((translation) => {
			const entity = resolveTranslationEntity(translation.target, created);
			if (!entity) return null;
			return {
				profile_id: profileId,
				entity_type: entity.entity_type,
				entity_id: entity.entity_id,
				field: translation.field,
				locale: translation.locale,
				value: translation.value,
				date_created: now,
				date_updated: now
			};
		})
		.filter((row): row is NonNullable<typeof row> => row !== null);

	if (rows.length === 0) return 0;

	// Chunked: a fully translated profile is one row per field per locale, which
	// grows past what a single parameterised statement should carry.
	const CHUNK = 500;
	for (let i = 0; i < rows.length; i += CHUNK) {
		await dbDirect.insert(profile_translations).values(rows.slice(i, i + CHUNK));
	}

	if (rows.length < translations.length) {
		console.warn(
			`[Import] Skipped ${translations.length - rows.length} translation(s) whose target did not resolve`
		);
	}

	return rows.length;
}

export async function deleteProfileTranslations(profileId: number): Promise<void> {
	await dbDirect.delete(profile_translations).where(eq(profile_translations.profile_id, profileId));
}
