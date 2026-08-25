/**
 * Export profile data (resume/CV/portfolio scope)
 */

import { dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import { buildDocumentExport, type ProjectIndexMaps } from './export-documents';
import { buildTranslationExport, emptyTranslationIndexMaps } from './export-translations';
import { buildTemplateExport } from './export-templates';
import type {
	DocumentFilePayload,
	ExportContentOptions,
	ExportedProfileData,
	ProfileExportData,
	MediaFile,
	TemplateAssetPayload
} from './types';

/**
 * Build profile export data
 */
export async function buildProfileExport(
	profileId: number,
	options: ExportContentOptions = {}
): Promise<{
	data: ProfileExportData;
	mediaFiles: MediaFile[];
	documentFiles: DocumentFilePayload[];
	templateAssets: TemplateAssetPayload[];
}> {
	const { includeMedia = false, includeDocuments = false } = options;
	const profile = await dbDirect.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		with: {
			profile_versions: {
				// Library only. The payload keys versions by slug and carries no
				// application reference, so an exported tailored version would be
				// restored as a library one — quietly polluting the list it was
				// designed to stay out of. Known limitation: a tailored version does
				// not survive a full export/import round trip.
				where: (t, { isNull }) => isNull(t.application_id),
				columns: {
					status: true,
					sort: true,
					slug: true,
					name: true,
					toggles: true
				},
				with: {
					extension_links: {
						with: {
							extended: {
								columns: { slug: true }
							}
						}
					}
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			highlights: {
				columns: { status: true, sort: true, text: true, fa_icon: true },
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			tech_skill_categories: {
				columns: {
					// id: translation overlay targets categories by position
					id: true,
					status: true,
					sort: true,
					name: true,
					fa_icon: true
				},
				with: {
					tech_skills: {
						columns: {
							status: true,
							sort: true,
							name: true,
							years_experience: true,
							level: true
						},
						with: {
							tech_skill_type: { columns: { slug: true } }
						},
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					}
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			work_experiences: {
				columns: {
					id: true,
					name: true,
					location: true,
					position: true,
					summary: true,
					status: true,
					sort: true,
					start_date: true,
					end_date: true,
					website: true,
					tags: true,
					logo_path: true,
					banner_path: true
				},
				with: {
					work_experience_achievements: {
						columns: {
							id: true,
							status: true,
							sort: true,
							description: true,
							fa_icon: true,
							tags: true
						},
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					},
					work_experience_technologies: {
						columns: { status: true, sort: true, name: true },
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					},
					work_experience_projects: {
						columns: {
							// Needed to attach documents by position; not emitted in the output.
							id: true,
							status: true,
							sort: true,
							name: true,
							url: true,
							start_date: true,
							end_date: true,
							description: true,
							outcome: true
						},
						with: {
							work_experience_project_technologies: {
								columns: { sort: true, name: true },
								orderBy: (t: any, { asc }: any) => asc(t.sort)
							}
						},
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					}
				},
				orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)]
			},
			side_projects: {
				columns: {
					id: true,
					status: true,
					sort: true,
					name: true,
					start_date: true,
					end_date: true,
					url: true,
					stars: true,
					summary: true,
					repo_url: true,
					image_path: true,
					banner_path: true,
					tags: true
				},
				with: {
					side_project_achievements: {
						columns: { id: true, description: true, sort: true },
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					},
					side_project_technologies: {
						columns: { sort: true, name: true },
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					}
				},
				orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)]
			},
			educations: {
				columns: {
					id: true,
					status: true,
					sort: true,
					institution: true,
					location: true,
					url: true,
					area: true,
					study_type: true,
					graduation_year: true,
					start_date: true,
					end_date: true,
					summary: true,
					logo_path: true,
					banner_path: true,
					tags: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			languages: {
				columns: {
					id: true,
					status: true,
					sort: true,
					name: true,
					language_code: true,
					proficiency: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			references: {
				columns: {
					status: true,
					sort: true,
					author: true,
					author_position: true,
					text: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			certificates: {
				columns: {
					status: true,
					sort: true,
					name: true,
					issuer: true,
					date: true,
					url: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			}
		}
	});

	if (!profile) {
		throw new Error(`Profile with ID ${profileId} not found`);
	}

	// Collect media files
	const mediaFiles: MediaFile[] = [];

	if (includeMedia) {
		// Profile photo
		if (profile.profile_photo_path) {
			mediaFiles.push({
				path: profile.profile_photo_path,
				archivePath: `media/${profile.profile_photo_path}`,
				entityType: 'profile',
				entityId: profileId,
				field: 'profile_photo_path'
			});
		}

		// Work experience media
		for (const work of profile.work_experiences) {
			for (const field of ['logo_path', 'banner_path'] as const) {
				const path = work[field];
				if (!path) continue;
				mediaFiles.push({
					path,
					archivePath: `media/${path}`,
					entityType: 'work_experience',
					entityId: work.id,
					field
				});
			}
		}

		// Education media
		for (const edu of profile.educations) {
			for (const field of ['logo_path', 'banner_path'] as const) {
				const path = edu[field];
				if (!path) continue;
				mediaFiles.push({
					path,
					archivePath: `media/${path}`,
					entityType: 'education',
					entityId: edu.id,
					field
				});
			}
		}

		// Side project media
		for (const proj of profile.side_projects) {
			for (const field of ['image_path', 'banner_path'] as const) {
				const path = proj[field];
				if (!path) continue;
				mediaFiles.push({
					path,
					archivePath: `media/${path}`,
					entityType: 'side_project',
					entityId: proj.id,
					field
				});
			}
		}
	}

	// Collect uploaded documents. Their parent is referenced by position in the
	// arrays built below, so the maps must be built from the same ordered rows.
	const documentFiles: DocumentFilePayload[] = [];
	let documents: ProfileExportData['documents'];

	if (includeDocuments) {
		const maps: ProjectIndexMaps = {
			workExperienceIndexById: new Map(),
			workExperienceProjectIndexById: new Map(),
			sideProjectIndexById: new Map()
		};

		profile.work_experiences.forEach((work, workIndex) => {
			maps.workExperienceIndexById.set(work.id, workIndex);
			work.work_experience_projects.forEach((proj, projectIndex) => {
				maps.workExperienceProjectIndexById.set(proj.id, {
					work_experience_index: workIndex,
					project_index: projectIndex
				});
			});
		});

		profile.side_projects.forEach((proj, index) => {
			maps.sideProjectIndexById.set(proj.id, index);
		});

		const built = await buildDocumentExport(profileId, maps);
		documents = built.documents;
		documentFiles.push(...built.documentFiles);
	}

	// Translation overlay. Always included: it is text the user authored, and it
	// is meaningless without the entities it hangs off, which are right here.
	const translationMaps = emptyTranslationIndexMaps(profileId);

	profile.work_experiences.forEach((work, workIndex) => {
		translationMaps.workExperience.set(work.id, workIndex);
		work.work_experience_achievements.forEach((achievement, achievementIndex) => {
			translationMaps.workExperienceAchievement.set(achievement.id, {
				work_experience_index: workIndex,
				achievement_index: achievementIndex
			});
		});
	});

	profile.side_projects.forEach((proj, projectIndex) => {
		translationMaps.sideProject.set(proj.id, projectIndex);
		proj.side_project_achievements.forEach((achievement, achievementIndex) => {
			translationMaps.sideProjectAchievement.set(achievement.id, {
				side_project_index: projectIndex,
				achievement_index: achievementIndex
			});
		});
	});

	profile.educations.forEach((edu, index) => translationMaps.education.set(edu.id, index));
	profile.tech_skill_categories.forEach((cat, index) =>
		translationMaps.techSkillCategory.set(cat.id, index)
	);
	profile.languages.forEach((lang, index) => translationMaps.language.set(lang.id, index));

	const translations = await buildTranslationExport(profileId, translationMaps);

	// Custom CV templates. The config is data the user built; its images are
	// media, so they follow the media switch.
	const { templates, assetPayloads: templateAssets } = await buildTemplateExport(
		profileId,
		includeMedia
	);

	// Helper to format dates (handles both Date objects and date strings from Drizzle)
	const formatDate = (date: Date | string | null): string | null => {
		if (!date) return null;
		return date instanceof Date ? date.toISOString().split('T')[0] : String(date);
	};

	// Build profile data
	const profileData: ExportedProfileData = {
		name: profile.name || undefined,
		title: profile.title || undefined,
		slug: profile.slug || undefined,
		location: profile.location || undefined,
		phone_number: profile.phone_number || undefined,
		email_address: profile.email_address || undefined,
		personal_website: profile.personal_website || undefined,
		linkedin_profile: profile.linkedin_profile || undefined,
		github_profile: profile.github_profile || undefined,
		stackoverflow_profile: profile.stackoverflow_profile || undefined,
		npm_profile: profile.npm_profile || undefined,
		pypi_profile: profile.pypi_profile || undefined,
		signal_profile: profile.signal_profile || undefined,
		whatsapp_number: profile.whatsapp_number || undefined,
		telegram_username: profile.telegram_username || undefined,
		subtitle: profile.subtitle || undefined,
		core_stack: profile.core_stack || undefined,
		headline: profile.headline || undefined,
		summary: profile.summary || undefined,
		about_me_text: profile.about_me_text || undefined,
		nationality: profile.nationality || undefined,
		location_url: profile.location_url || undefined,
		location_timezone: profile.location_timezone || undefined,
		meta_image_url: profile.meta_image_url || undefined,
		dev_start_year: profile.dev_start_year,
		python_js_start_year: profile.python_js_start_year,
		remote_start_year: profile.remote_start_year,
		company_name: profile.company_name || undefined,
		street_address: profile.street_address || undefined,
		postal_code: profile.postal_code || undefined,
		vat_id: profile.vat_id || undefined,
		kvk_number: profile.kvk_number || undefined,
		profile_photo_path: profile.profile_photo_path || undefined,

		profile_versions: profile.profile_versions.map((pv) => ({
			status: pv.status || undefined,
			sort: pv.sort,
			slug: pv.slug || undefined,
			name: pv.name || undefined,
			toggles: pv.toggles,
			extends_from: pv.extension_links?.[0]?.extended?.slug || null
		})),

		highlights: profile.highlights.map((h) => ({
			status: h.status || undefined,
			sort: h.sort,
			text: h.text || undefined,
			fa_icon: h.fa_icon || undefined
		})),

		tech_skill_categories: profile.tech_skill_categories.map((cat) => ({
			status: cat.status || undefined,
			sort: cat.sort,
			name: cat.name || undefined,
			fa_icon: cat.fa_icon || undefined,
			tech_skills: cat.tech_skills.map((skill) => ({
				status: skill.status || undefined,
				sort: skill.sort,
				name: skill.name || undefined,
				years_experience: skill.years_experience?.toString() || undefined,
				level: skill.level || undefined,
				tech_type: skill.tech_skill_type?.slug || null
			}))
		})),

		work_experiences: profile.work_experiences.map((work) => ({
			name: work.name || undefined,
			location: work.location || undefined,
			position: work.position || undefined,
			summary: work.summary || undefined,
			status: work.status || undefined,
			sort: work.sort,
			start_date: formatDate(work.start_date),
			end_date: formatDate(work.end_date),
			website: work.website || undefined,
			tags: work.tags,
			logo_path: work.logo_path || undefined,
			banner_path: work.banner_path || undefined,
			achievements: work.work_experience_achievements.map((a) => ({
				status: a.status || undefined,
				sort: a.sort,
				description: a.description || undefined,
				fa_icon: a.fa_icon || undefined,
				tags: a.tags
			})),
			technologies: work.work_experience_technologies.map((t) => ({
				status: t.status || undefined,
				sort: t.sort,
				name: t.name || undefined
			})),
			projects: work.work_experience_projects.map((p) => ({
				status: p.status || undefined,
				sort: p.sort,
				name: p.name || '',
				url: p.url || undefined,
				start_date: formatDate(p.start_date),
				end_date: formatDate(p.end_date),
				description: p.description || undefined,
				outcome: p.outcome || undefined,
				technologies: p.work_experience_project_technologies.map((t) => ({
					sort: t.sort,
					name: t.name || undefined
				}))
			}))
		})),

		side_projects: profile.side_projects.map((proj) => ({
			status: proj.status || undefined,
			sort: proj.sort,
			name: proj.name || undefined,
			start_date: formatDate(proj.start_date),
			end_date: formatDate(proj.end_date),
			url: proj.url || undefined,
			stars: proj.stars,
			summary: proj.summary || undefined,
			repo_url: proj.repo_url || undefined,
			image_path: proj.image_path || undefined,
			banner_path: proj.banner_path || undefined,
			tags: proj.tags,
			achievements: proj.side_project_achievements.map((a) => ({
				description: a.description || undefined,
				sort: a.sort
			})),
			technologies: proj.side_project_technologies.map((t) => ({
				sort: t.sort,
				name: t.name || undefined
			}))
		})),

		education: profile.educations.map((edu) => ({
			status: edu.status || undefined,
			sort: edu.sort,
			institution: edu.institution || undefined,
			location: edu.location || undefined,
			url: edu.url || undefined,
			area: edu.area || undefined,
			study_type: edu.study_type || undefined,
			graduation_year: edu.graduation_year,
			start_date: formatDate(edu.start_date),
			end_date: formatDate(edu.end_date),
			summary: edu.summary || undefined,
			logo_path: edu.logo_path || undefined,
			banner_path: edu.banner_path || undefined,
			tags: edu.tags
		})),

		languages: profile.languages.map((l) => ({
			status: l.status || undefined,
			sort: l.sort,
			name: l.name || undefined,
			language_code: l.language_code || undefined,
			proficiency: l.proficiency || undefined
		})),

		references: profile.references.map((r) => ({
			status: r.status || undefined,
			sort: r.sort,
			author: r.author || undefined,
			author_position: r.author_position || undefined,
			text: r.text || undefined
		})),

		certificates: profile.certificates.map((c) => ({
			status: c.status || undefined,
			sort: c.sort,
			name: c.name || undefined,
			issuer: c.issuer || undefined,
			date: formatDate(c.date),
			url: c.url || undefined
		}))
	};

	const hasDocuments = Boolean(documents && documents.length > 0);

	const exportData: ProfileExportData = {
		version: '2.0',
		exported_at: new Date().toISOString(),
		scope: 'profile',
		has_media: includeMedia && mediaFiles.length > 0,
		media_files: includeMedia && mediaFiles.length > 0 ? mediaFiles : undefined,
		has_documents: hasDocuments,
		documents: hasDocuments ? documents : undefined,
		translations: translations.length > 0 ? translations : undefined,
		resume_templates: templates.length > 0 ? templates : undefined,
		profile: profileData
	};

	return { data: exportData, mediaFiles, documentFiles, templateAssets };
}

/**
 * Get profile name for filename
 */
export async function getProfileName(profileId: number): Promise<string> {
	const profile = await dbDirect.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { name: true }
	});
	return profile?.name?.replace(/\s+/g, '-').toLowerCase() || 'profile';
}
