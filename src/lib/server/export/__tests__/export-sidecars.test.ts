/**
 * The two sidecars that hang off entity ids: the translation overlay and CV
 * templates.
 *
 * Translations are positional like documents, so the property that matters is
 * the same one: a target recorded on export must resolve to the right entity
 * after an import assigns entirely different ids. Templates are the other
 * shape — their config references files by id, and those ids change on import.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	dbDirect: { query: {}, insert: vi.fn(), delete: vi.fn() }
}));

vi.mock('$lib/server/files', () => ({
	getFile: vi.fn(),
	uploadFile: vi.fn()
}));

import { emptyTranslationIndexMaps, resolveTranslationTarget } from '../export-translations';
import { emptyCreatedTranslationIds, resolveTranslationEntity } from '../import-translations';
import { collectFileIdCandidates } from '../export-templates';
import { rewriteConfigFileIds } from '../import-templates';

describe('translation targets', () => {
	function exportMaps() {
		const maps = emptyTranslationIndexMaps(7);
		maps.workExperience.set(100, 0);
		maps.workExperienceAchievement.set(200, { work_experience_index: 0, achievement_index: 2 });
		maps.sideProject.set(300, 1);
		maps.sideProjectAchievement.set(400, { side_project_index: 1, achievement_index: 0 });
		maps.education.set(500, 3);
		maps.techSkillCategory.set(600, 2);
		maps.language.set(700, 1);
		return maps;
	}

	function importIds() {
		const created = emptyCreatedTranslationIds(99);
		created.workExperienceIdByIndex = [900];
		created.workExperienceAchievementIdByIndex.set('0:2', 910);
		created.sideProjectIdByIndex = [920, 921];
		created.sideProjectAchievementIdByIndex.set('1:0', 930);
		created.educationIdByIndex = [940, 941, 942, 943];
		created.techSkillCategoryIdByIndex = [950, 951, 952];
		created.languageIdByIndex = [960, 961];
		return created;
	}

	// Every entity type the overlay actually uses, round-tripped through a fresh
	// set of ids — the ids on either side deliberately share nothing.
	it.each([
		['profile', 7, 'profile', 99],
		['work_experience', 100, 'work_experience', 900],
		['work_experience_achievement', 200, 'work_experience_achievement', 910],
		['side_project', 300, 'side_project', 921],
		['side_project_achievement', 400, 'side_project_achievement', 930],
		['education', 500, 'education', 943],
		['tech_skill_category', 600, 'tech_skill_category', 952],
		['language', 700, 'language', 961]
	])('round-trips %s', (entityType, entityId, expectedType, expectedId) => {
		const target = resolveTranslationTarget(entityType as string, entityId as number, exportMaps());
		expect(target).not.toBeNull();

		expect(resolveTranslationEntity(target!, importIds())).toEqual({
			entity_type: expectedType,
			entity_id: expectedId
		});
	});

	it('drops a translation whose entity is gone', () => {
		expect(resolveTranslationTarget('work_experience', 999, exportMaps())).toBeNull();
		expect(resolveTranslationTarget('nonsense_type', 100, exportMaps())).toBeNull();
	});

	it('does not claim a profile translation from another profile', () => {
		expect(resolveTranslationTarget('profile', 8, exportMaps())).toBeNull();
	});

	it('skips a target that no longer resolves on import', () => {
		const created = emptyCreatedTranslationIds(99);
		expect(resolveTranslationEntity({ kind: 'education', education_index: 4 }, created)).toBeNull();
	});
});

describe('template assets', () => {
	const BADGE = '8306a313-6958-4bba-b325-3a4fcd9ceffd';
	const THUMB = '696aa4ad-010a-4e85-8cf2-87d77a1ea5f1';

	it('finds file ids wherever the config puts them', () => {
		const config = {
			accent: '#FFD400',
			assets: { badge: BADGE },
			thumbnail: THUMB,
			nested: [{ deeper: { alsoAnAsset: BADGE } }]
		};

		const found = collectFileIdCandidates(config);
		expect(found).toHaveLength(2);
		expect(found).toEqual(expect.arrayContaining([BADGE, THUMB]));
	});

	it('ignores values that merely look like config', () => {
		expect(collectFileIdCandidates({ accent: '#FFD400', font: 'Poppins' })).toEqual([]);
	});

	it('rewrites every reference to a reuploaded asset', () => {
		const config = { assets: { badge: BADGE }, thumbnail: THUMB, copy: [BADGE] };
		const idMap = new Map([
			[BADGE, 'new-badge-id'],
			[THUMB, 'new-thumb-id']
		]);

		expect(rewriteConfigFileIds(config, idMap)).toEqual({
			assets: { badge: 'new-badge-id' },
			thumbnail: 'new-thumb-id',
			copy: ['new-badge-id']
		});
	});

	it('leaves the config untouched when nothing was reuploaded', () => {
		const config = { assets: { badge: BADGE }, fonts: { body: 'Carlito' } };
		expect(rewriteConfigFileIds(config, new Map())).toEqual(config);
	});
});
