/**
 * Applies a selective diff to an existing profile.
 * Only modifies the fields/items the user has enabled.
 */

import { dbDirect } from '$lib/server/db';
import { eq, and, max } from 'drizzle-orm';
import {
	profiles,
	work_experiences,
	work_experience_achievements,
	work_experience_technologies,
	work_experience_projects,
	work_experience_project_technologies,
	education,
	tech_skill_categories,
	tech_skills,
	languages,
	side_projects,
	side_project_achievements,
	side_project_technologies,
	certificates,
	references
} from '$lib/server/db/schema';
import type {
	ResumeData,
	ResumeBasics,
	WorkExperience,
	Education,
	SkillCategory,
	Language,
	SideProject,
	Certificate,
	Reference
} from './types';

export interface DiffApplyPayload {
	/** Basic profile fields to update (only changed+enabled ones) */
	basics?: Partial<ResumeBasics>;
	/** Work experience changes */
	work?: {
		added?: WorkExperience[];
		modified?: Array<{
			matchKey: string;
			fields: Partial<WorkExperience>;
			addAchievements?: string[];
			removeAchievements?: string[];
			addTechnologies?: string[];
			removeTechnologies?: string[];
		}>;
		removed?: string[];
	};
	/** Education changes */
	education?: {
		added?: Education[];
		modified?: Array<{
			matchKey: string;
			fields: Partial<Education>;
		}>;
		removed?: string[];
	};
	/** Skill category changes */
	skills?: {
		added?: SkillCategory[];
		modified?: Array<{
			matchKey: string;
			fields?: Partial<{ name: string }>;
			addSkills?: Array<{ name: string; level?: string; yearsExperience?: number }>;
			removeSkills?: string[];
			modifySkills?: Array<{
				name: string;
				fields: Partial<{ name: string; level: string; yearsExperience: number }>;
			}>;
		}>;
		removed?: string[];
	};
	/** Language changes */
	languages?: {
		added?: Language[];
		modified?: Array<{
			matchKey: string;
			fields: Partial<Language>;
		}>;
		removed?: string[];
	};
	/** Project changes */
	projects?: {
		added?: SideProject[];
		modified?: Array<{
			matchKey: string;
			fields: Partial<SideProject>;
			addAchievements?: string[];
			removeAchievements?: string[];
			addTechnologies?: string[];
			removeTechnologies?: string[];
		}>;
		removed?: string[];
	};
	/** Certificate changes */
	certificates?: {
		added?: Certificate[];
		modified?: Array<{
			matchKey: string;
			fields: Partial<Certificate>;
		}>;
		removed?: string[];
	};
	/** Reference changes */
	references?: {
		added?: Reference[];
		modified?: Array<{
			matchKey: string;
			fields: Partial<Reference>;
		}>;
		removed?: string[];
	};
}

const basicsFieldMap: Record<string, string> = {
	name: 'name',
	title: 'title',
	email: 'email_address',
	phone: 'phone_number',
	location: 'location',
	summary: 'summary',
	website: 'personal_website',
	linkedin: 'linkedin_profile',
	github: 'github_profile',
	stackoverflow: 'stackoverflow_profile',
	headline: 'headline',
	subtitle: 'subtitle',
	coreStack: 'core_stack'
};

/**
 * Resume-diff dates come as ISO-ish strings; the destination columns are
 * Drizzle `date()` (string mode), so coerce to YYYY-MM-DD or null.
 */
function parseDate(value: string | null | undefined): string | null {
	if (!value) return null;
	const d = new Date(value);
	if (isNaN(d.getTime())) return null;
	return d.toISOString().split('T')[0];
}

async function getMaxSort(table: any, whereCol: any, whereVal: any): Promise<number> {
	const [result] = await dbDirect
		.select({ value: max(table.sort) })
		.from(table)
		.where(eq(whereCol, whereVal));
	return result?.value ?? 0;
}

export async function applyDiffToProfile(
	profileId: number,
	userId: string,
	payload: DiffApplyPayload
): Promise<void> {
	const profile = await dbDirect.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
		columns: { id: true }
	});
	if (!profile) throw new Error('Profile not found or not owned by user');

	// --- Apply basics ---
	if (payload.basics && Object.keys(payload.basics).length > 0) {
		const updateData: Record<string, unknown> = { date_updated: new Date() };
		for (const [field, value] of Object.entries(payload.basics)) {
			const dbField = basicsFieldMap[field];
			if (dbField) {
				updateData[dbField] = (typeof value === 'string' ? value.trim() : value) || null;
			}
		}
		await dbDirect.update(profiles).set(updateData).where(eq(profiles.id, profileId));
	}

	// --- Apply work experience changes ---
	if (payload.work) {
		for (const w of payload.work.added ?? []) {
			const [created] = await dbDirect
				.insert(work_experiences)
				.values({
					profile_id: profileId,
					name: w.name || '',
					position: w.position || '',
					location: w.location || '',
					description: '',
					summary: w.summary || '',
					status: 'draft',
					start_date: parseDate(w.startDate),
					end_date: parseDate(w.endDate),
					website: w.website || null
				})
				.returning();

			let sort = 1;
			for (const ach of w.achievements ?? []) {
				await dbDirect.insert(work_experience_achievements).values({
					work_experience_id: created.id,
					description: ach,
					status: 'draft',
					sort: sort++
				});
			}
			sort = 1;
			for (const tech of w.technologies ?? []) {
				await dbDirect
					.insert(work_experience_technologies)
					.values({ work_experience_id: created.id, name: tech, status: 'draft', sort: sort++ });
			}
		}

		for (const mod of payload.work.modified ?? []) {
			const [company, position] = mod.matchKey.split('|||');
			const existing = await dbDirect.query.work_experiences.findFirst({
				where: and(
					eq(work_experiences.profile_id, profileId),
					eq(work_experiences.name, company),
					eq(work_experiences.position, position)
				),
				columns: { id: true }
			});
			if (!existing) continue;

			const updateData: Record<string, unknown> = {};
			if (mod.fields.name !== undefined) updateData.name = mod.fields.name;
			if (mod.fields.position !== undefined) updateData.position = mod.fields.position;
			if (mod.fields.location !== undefined) updateData.location = mod.fields.location || '';
			if (mod.fields.website !== undefined) updateData.website = mod.fields.website || null;
			if (mod.fields.startDate !== undefined)
				updateData.start_date = parseDate(mod.fields.startDate);
			if (mod.fields.endDate !== undefined) updateData.end_date = parseDate(mod.fields.endDate);
			if (mod.fields.summary !== undefined) updateData.summary = mod.fields.summary || '';

			if (Object.keys(updateData).length > 0) {
				await dbDirect
					.update(work_experiences)
					.set(updateData)
					.where(eq(work_experiences.id, existing.id));
			}

			if (mod.addAchievements?.length) {
				let sort =
					(await getMaxSort(
						work_experience_achievements,
						work_experience_achievements.work_experience_id,
						existing.id
					)) + 1;
				for (const ach of mod.addAchievements) {
					await dbDirect.insert(work_experience_achievements).values({
						work_experience_id: existing.id,
						description: ach,
						status: 'draft',
						sort: sort++
					});
				}
			}
			if (mod.removeAchievements?.length) {
				for (const ach of mod.removeAchievements) {
					await dbDirect
						.delete(work_experience_achievements)
						.where(
							and(
								eq(work_experience_achievements.work_experience_id, existing.id),
								eq(work_experience_achievements.description, ach)
							)
						);
				}
			}
			if (mod.addTechnologies?.length) {
				let sort =
					(await getMaxSort(
						work_experience_technologies,
						work_experience_technologies.work_experience_id,
						existing.id
					)) + 1;
				for (const tech of mod.addTechnologies) {
					await dbDirect
						.insert(work_experience_technologies)
						.values({ work_experience_id: existing.id, name: tech, status: 'draft', sort: sort++ });
				}
			}
			if (mod.removeTechnologies?.length) {
				for (const tech of mod.removeTechnologies) {
					await dbDirect
						.delete(work_experience_technologies)
						.where(
							and(
								eq(work_experience_technologies.work_experience_id, existing.id),
								eq(work_experience_technologies.name, tech)
							)
						);
				}
			}
		}

		for (const key of payload.work.removed ?? []) {
			const [company, position] = key.split('|||');
			const existing = await dbDirect.query.work_experiences.findFirst({
				where: and(
					eq(work_experiences.profile_id, profileId),
					eq(work_experiences.name, company),
					eq(work_experiences.position, position)
				),
				columns: { id: true }
			});
			if (!existing) continue;
			await dbDirect
				.delete(work_experience_achievements)
				.where(eq(work_experience_achievements.work_experience_id, existing.id));
			await dbDirect
				.delete(work_experience_technologies)
				.where(eq(work_experience_technologies.work_experience_id, existing.id));
			const projects = await dbDirect.query.work_experience_projects.findMany({
				where: eq(work_experience_projects.work_experience_id, existing.id),
				columns: { id: true }
			});
			for (const proj of projects) {
				await dbDirect
					.delete(work_experience_project_technologies)
					.where(eq(work_experience_project_technologies.work_experience_project_id, proj.id));
			}
			await dbDirect
				.delete(work_experience_projects)
				.where(eq(work_experience_projects.work_experience_id, existing.id));
			await dbDirect.delete(work_experiences).where(eq(work_experiences.id, existing.id));
		}
	}

	// --- Apply education changes ---
	if (payload.education) {
		for (const e of payload.education.added ?? []) {
			await dbDirect.insert(education).values({
				profile_id: profileId,
				status: 'draft',
				institution: e.institution || null,
				area: e.area || null,
				study_type: e.studyType || null,
				location: e.location || null,
				url: e.url || null,
				start_date: parseDate(e.startDate),
				end_date: parseDate(e.endDate),
				graduation_year: e.graduationYear ?? null,
				summary: e.summary || null
			});
		}

		for (const mod of payload.education.modified ?? []) {
			const [institution, area] = mod.matchKey.split('|||');
			const existing = await dbDirect.query.education.findFirst({
				where: and(
					eq(education.profile_id, profileId),
					eq(education.institution, institution),
					area ? eq(education.area, area) : (undefined as any)
				),
				columns: { id: true }
			});
			if (!existing) continue;
			const updateData: Record<string, unknown> = {};
			if (mod.fields.institution !== undefined)
				updateData.institution = mod.fields.institution || null;
			if (mod.fields.area !== undefined) updateData.area = mod.fields.area || null;
			if (mod.fields.studyType !== undefined) updateData.study_type = mod.fields.studyType || null;
			if (mod.fields.location !== undefined) updateData.location = mod.fields.location || null;
			if (mod.fields.url !== undefined) updateData.url = mod.fields.url || null;
			if (mod.fields.startDate !== undefined)
				updateData.start_date = parseDate(mod.fields.startDate);
			if (mod.fields.endDate !== undefined) updateData.end_date = parseDate(mod.fields.endDate);
			if (mod.fields.graduationYear !== undefined)
				updateData.graduation_year = mod.fields.graduationYear ?? null;
			if (mod.fields.summary !== undefined) updateData.summary = mod.fields.summary || null;
			if (Object.keys(updateData).length > 0) {
				await dbDirect.update(education).set(updateData).where(eq(education.id, existing.id));
			}
		}

		for (const key of payload.education.removed ?? []) {
			const [institution, area] = key.split('|||');
			await dbDirect
				.delete(education)
				.where(and(eq(education.profile_id, profileId), eq(education.institution, institution)));
		}
	}

	// --- Apply skill changes ---
	if (payload.skills) {
		for (const cat of payload.skills.added ?? []) {
			const [created] = await dbDirect
				.insert(tech_skill_categories)
				.values({ profile_id: profileId, name: cat.name || null, status: 'draft' })
				.returning();
			let sort = 1;
			for (const skill of cat.skills ?? []) {
				await dbDirect.insert(tech_skills).values({
					category_id: created.id,
					name: skill.name || null,
					level: skill.level || null,
					years_experience: skill.yearsExperience ?? null,
					status: 'draft',
					sort: sort++
				});
			}
		}

		for (const mod of payload.skills.modified ?? []) {
			const existing = await dbDirect.query.tech_skill_categories.findFirst({
				where: and(
					eq(tech_skill_categories.profile_id, profileId),
					eq(tech_skill_categories.name, mod.matchKey)
				),
				columns: { id: true }
			});
			if (!existing) continue;

			if (mod.addSkills?.length) {
				let sort = (await getMaxSort(tech_skills, tech_skills.category_id, existing.id)) + 1;
				for (const skill of mod.addSkills) {
					await dbDirect.insert(tech_skills).values({
						category_id: existing.id,
						name: skill.name || null,
						level: skill.level || null,
						years_experience: skill.yearsExperience ?? null,
						status: 'draft',
						sort: sort++
					});
				}
			}
			if (mod.removeSkills?.length) {
				for (const name of mod.removeSkills) {
					await dbDirect
						.delete(tech_skills)
						.where(and(eq(tech_skills.category_id, existing.id), eq(tech_skills.name, name)));
				}
			}
			if (mod.modifySkills?.length) {
				for (const skillMod of mod.modifySkills) {
					const skill = await dbDirect.query.tech_skills.findFirst({
						where: and(
							eq(tech_skills.category_id, existing.id),
							eq(tech_skills.name, skillMod.name)
						),
						columns: { id: true }
					});
					if (!skill) continue;
					const updateData: Record<string, unknown> = {};
					if (skillMod.fields.level !== undefined) updateData.level = skillMod.fields.level || null;
					if (skillMod.fields.yearsExperience !== undefined)
						updateData.years_experience = skillMod.fields.yearsExperience ?? null;
					if (Object.keys(updateData).length > 0) {
						await dbDirect.update(tech_skills).set(updateData).where(eq(tech_skills.id, skill.id));
					}
				}
			}
		}

		for (const name of payload.skills.removed ?? []) {
			const existing = await dbDirect.query.tech_skill_categories.findFirst({
				where: and(
					eq(tech_skill_categories.profile_id, profileId),
					eq(tech_skill_categories.name, name)
				),
				columns: { id: true }
			});
			if (!existing) continue;
			await dbDirect.delete(tech_skills).where(eq(tech_skills.category_id, existing.id));
			await dbDirect.delete(tech_skill_categories).where(eq(tech_skill_categories.id, existing.id));
		}
	}

	// --- Apply language changes ---
	if (payload.languages) {
		for (const l of payload.languages.added ?? []) {
			await dbDirect.insert(languages).values({
				profile_id: profileId,
				status: 'draft',
				name: l.name || null,
				language_code: l.languageCode || null,
				proficiency: l.proficiency || null
			});
		}
		for (const mod of payload.languages.modified ?? []) {
			const existing = await dbDirect.query.languages.findFirst({
				where: and(eq(languages.profile_id, profileId), eq(languages.name, mod.matchKey)),
				columns: { id: true }
			});
			if (!existing) continue;
			const updateData: Record<string, unknown> = {};
			if (mod.fields.languageCode !== undefined)
				updateData.language_code = mod.fields.languageCode || null;
			if (mod.fields.proficiency !== undefined)
				updateData.proficiency = mod.fields.proficiency || null;
			if (Object.keys(updateData).length > 0) {
				await dbDirect.update(languages).set(updateData).where(eq(languages.id, existing.id));
			}
		}
		for (const name of payload.languages.removed ?? []) {
			await dbDirect
				.delete(languages)
				.where(and(eq(languages.profile_id, profileId), eq(languages.name, name)));
		}
	}

	// --- Apply project changes ---
	if (payload.projects) {
		for (const p of payload.projects.added ?? []) {
			const [created] = await dbDirect
				.insert(side_projects)
				.values({
					profile_id: profileId,
					status: 'draft',
					name: p.name || null,
					url: p.url || null,
					repo_url: p.repoUrl || null,
					summary: p.summary || null,
					start_date: parseDate(p.startDate),
					end_date: parseDate(p.endDate),
					stars: p.stars ?? null
				})
				.returning();
			let sort = 1;
			for (const ach of p.achievements ?? []) {
				await dbDirect
					.insert(side_project_achievements)
					.values({ side_project_id: created.id, description: ach, sort: sort++ });
			}
			sort = 1;
			for (const tech of p.technologies ?? []) {
				await dbDirect
					.insert(side_project_technologies)
					.values({ side_project_id: created.id, name: tech, sort: sort++ });
			}
		}

		for (const mod of payload.projects.modified ?? []) {
			const existing = await dbDirect.query.side_projects.findFirst({
				where: and(eq(side_projects.profile_id, profileId), eq(side_projects.name, mod.matchKey)),
				columns: { id: true }
			});
			if (!existing) continue;
			const updateData: Record<string, unknown> = {};
			if (mod.fields.name !== undefined) updateData.name = mod.fields.name || null;
			if (mod.fields.url !== undefined) updateData.url = mod.fields.url || null;
			if (mod.fields.repoUrl !== undefined) updateData.repo_url = mod.fields.repoUrl || null;
			if (mod.fields.summary !== undefined) updateData.summary = mod.fields.summary || null;
			if (mod.fields.startDate !== undefined)
				updateData.start_date = parseDate(mod.fields.startDate);
			if (mod.fields.endDate !== undefined) updateData.end_date = parseDate(mod.fields.endDate);
			if (mod.fields.stars !== undefined) updateData.stars = mod.fields.stars ?? null;
			if (Object.keys(updateData).length > 0) {
				await dbDirect
					.update(side_projects)
					.set(updateData)
					.where(eq(side_projects.id, existing.id));
			}
			if (mod.addAchievements?.length) {
				let sort =
					(await getMaxSort(
						side_project_achievements,
						side_project_achievements.side_project_id,
						existing.id
					)) + 1;
				for (const ach of mod.addAchievements) {
					await dbDirect
						.insert(side_project_achievements)
						.values({ side_project_id: existing.id, description: ach, sort: sort++ });
				}
			}
			if (mod.removeAchievements?.length) {
				for (const ach of mod.removeAchievements) {
					await dbDirect
						.delete(side_project_achievements)
						.where(
							and(
								eq(side_project_achievements.side_project_id, existing.id),
								eq(side_project_achievements.description, ach)
							)
						);
				}
			}
			if (mod.addTechnologies?.length) {
				let sort =
					(await getMaxSort(
						side_project_technologies,
						side_project_technologies.side_project_id,
						existing.id
					)) + 1;
				for (const tech of mod.addTechnologies) {
					await dbDirect
						.insert(side_project_technologies)
						.values({ side_project_id: existing.id, name: tech, sort: sort++ });
				}
			}
			if (mod.removeTechnologies?.length) {
				for (const tech of mod.removeTechnologies) {
					await dbDirect
						.delete(side_project_technologies)
						.where(
							and(
								eq(side_project_technologies.side_project_id, existing.id),
								eq(side_project_technologies.name, tech)
							)
						);
				}
			}
		}

		for (const name of payload.projects.removed ?? []) {
			const existing = await dbDirect.query.side_projects.findFirst({
				where: and(eq(side_projects.profile_id, profileId), eq(side_projects.name, name)),
				columns: { id: true }
			});
			if (!existing) continue;
			await dbDirect
				.delete(side_project_achievements)
				.where(eq(side_project_achievements.side_project_id, existing.id));
			await dbDirect
				.delete(side_project_technologies)
				.where(eq(side_project_technologies.side_project_id, existing.id));
			await dbDirect.delete(side_projects).where(eq(side_projects.id, existing.id));
		}
	}

	// --- Apply certificate changes ---
	if (payload.certificates) {
		for (const c of payload.certificates.added ?? []) {
			await dbDirect.insert(certificates).values({
				profile_id: profileId,
				status: 'draft',
				name: c.name || '',
				issuer: c.issuer || null,
				date: parseDate(c.date),
				url: c.url || null,
				sort: 0,
				date_created: new Date()
			});
		}
		for (const mod of payload.certificates.modified ?? []) {
			const existing = await dbDirect.query.certificates.findFirst({
				where: and(eq(certificates.profile_id, profileId), eq(certificates.name, mod.matchKey)),
				columns: { id: true }
			});
			if (!existing) continue;
			const updateData: Record<string, unknown> = {};
			if (mod.fields.name !== undefined) updateData.name = mod.fields.name || '';
			if (mod.fields.issuer !== undefined) updateData.issuer = mod.fields.issuer || null;
			if (mod.fields.date !== undefined) updateData.date = parseDate(mod.fields.date);
			if (mod.fields.url !== undefined) updateData.url = mod.fields.url || null;
			if (Object.keys(updateData).length > 0) {
				updateData.date_updated = new Date();
				await dbDirect.update(certificates).set(updateData).where(eq(certificates.id, existing.id));
			}
		}
		for (const name of payload.certificates.removed ?? []) {
			await dbDirect
				.delete(certificates)
				.where(and(eq(certificates.profile_id, profileId), eq(certificates.name, name)));
		}
	}

	// --- Apply reference changes ---
	if (payload.references) {
		for (const r of payload.references.added ?? []) {
			await dbDirect.insert(references).values({
				profile_id: profileId,
				status: 'draft',
				author: r.author || '',
				author_position: r.authorPosition || null,
				text: r.text || null
			});
		}
		for (const mod of payload.references.modified ?? []) {
			const existing = await dbDirect.query.references.findFirst({
				where: and(eq(references.profile_id, profileId), eq(references.author, mod.matchKey)),
				columns: { id: true }
			});
			if (!existing) continue;
			const updateData: Record<string, unknown> = {};
			if (mod.fields.author !== undefined) updateData.author = mod.fields.author || '';
			if (mod.fields.authorPosition !== undefined)
				updateData.author_position = mod.fields.authorPosition || null;
			if (mod.fields.text !== undefined) updateData.text = mod.fields.text || null;
			if (Object.keys(updateData).length > 0) {
				await dbDirect.update(references).set(updateData).where(eq(references.id, existing.id));
			}
		}
		for (const author of payload.references.removed ?? []) {
			await dbDirect
				.delete(references)
				.where(and(eq(references.profile_id, profileId), eq(references.author, author)));
		}
	}
}
