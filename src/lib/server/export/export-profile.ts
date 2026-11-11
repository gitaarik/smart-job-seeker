/**
 * Export profile data (resume/CV/portfolio scope)
 */

import { dbDirect } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { profile_field_variants, profiles } from '$lib/server/db/schema';
import {
	CERTIFICATE_COLUMNS,
	CERTIFICATE_SKILL_COLUMNS,
	EDUCATION_COLUMNS,
	FIELD_VARIANT_COLUMNS,
	HIGHLIGHT_COLUMNS,
	LANGUAGE_COLUMNS,
	PROFILE_COLUMNS,
	REFERENCE_COLUMNS,
	ROLE_ACHIEVEMENT_COLUMNS,
	ROLE_COLUMNS,
	ROLE_PROJECT_COLUMNS,
	ROLE_PROJECT_TECHNOLOGY_COLUMNS,
	ROLE_TECHNOLOGY_COLUMNS,
	SIDE_PROJECT_ACHIEVEMENT_COLUMNS,
	SIDE_PROJECT_COLUMNS,
	SIDE_PROJECT_TECHNOLOGY_COLUMNS,
	SKILL_CATEGORY_COLUMNS,
	SKILL_COLUMNS,
	VERSION_COLUMNS
} from './export-columns';
import { buildDocumentExport, type ProjectIndexMaps } from './export-documents';
import { buildTranslationExport, emptyTranslationIndexMaps } from './export-translations';
import { buildTemplateExport } from './export-templates';
import { buildMediaLibraryExport } from './export-media-library';
import type {
	ArchiveFilePayload,
	DocumentFilePayload,
	ExportContentOptions,
	ExportedFieldVariant,
	ExportedProfileData,
	ProfileExportData,
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
	documentFiles: DocumentFilePayload[];
	templateAssets: TemplateAssetPayload[];
	/** The media library's originals and drawn renditions (only with media). */
	libraryFiles: ArchiveFilePayload[];
}> {
	const { includeMedia = false, includeDocuments = false } = options;
	const profile = await dbDirect.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: PROFILE_COLUMNS,
		with: {
			profile_versions: {
				// Library only. The payload keys versions by slug and carries no
				// application reference, so an exported tailored version would be
				// restored as a library one — quietly polluting the list it was
				// designed to stay out of. Known limitation: a tailored version does
				// not survive a full export/import round trip.
				where: (t, { isNull }) => isNull(t.application_id),
				columns: VERSION_COLUMNS,
				with: {
					extension_links: {
						with: {
							extended: {
								columns: { slug: true }
							}
						}
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			highlights: {
				columns: HIGHLIGHT_COLUMNS,
				orderBy: (t, { asc }) => asc(t.sort)
			},
			tech_skill_categories: {
				columns: SKILL_CATEGORY_COLUMNS,
				with: {
					tech_skills: {
						columns: SKILL_COLUMNS,
						with: {
							tech_skill_type: { columns: { slug: true } }
						},
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			work_experiences: {
				columns: ROLE_COLUMNS,
				with: {
					work_experience_achievements: {
						columns: ROLE_ACHIEVEMENT_COLUMNS,
						orderBy: (t, { asc }) => asc(t.sort)
					},
					work_experience_technologies: {
						columns: ROLE_TECHNOLOGY_COLUMNS,
						orderBy: (t, { asc }) => asc(t.sort)
					},
					work_experience_projects: {
						columns: ROLE_PROJECT_COLUMNS,
						with: {
							work_experience_project_technologies: {
								columns: ROLE_PROJECT_TECHNOLOGY_COLUMNS,
								orderBy: (t, { asc }) => asc(t.sort)
							}
						},
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc, desc }) => [asc(t.sort), desc(t.start_date)]
			},
			side_projects: {
				columns: SIDE_PROJECT_COLUMNS,
				with: {
					side_project_achievements: {
						columns: SIDE_PROJECT_ACHIEVEMENT_COLUMNS,
						orderBy: (t, { asc }) => asc(t.sort)
					},
					side_project_technologies: {
						columns: SIDE_PROJECT_TECHNOLOGY_COLUMNS,
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc, desc }) => [asc(t.sort), desc(t.start_date)]
			},
			educations: {
				columns: EDUCATION_COLUMNS,
				orderBy: (t, { asc }) => asc(t.sort)
			},
			languages: {
				columns: LANGUAGE_COLUMNS,
				orderBy: (t, { asc }) => asc(t.sort)
			},
			field_variants: {
				columns: FIELD_VARIANT_COLUMNS,
				orderBy: [asc(profile_field_variants.sort), asc(profile_field_variants.id)]
			},
			references: {
				columns: REFERENCE_COLUMNS,
				orderBy: (t, { asc }) => asc(t.sort)
			},
			certificates: {
				columns: CERTIFICATE_COLUMNS,
				with: {
					certificate_skills: {
						columns: CERTIFICATE_SKILL_COLUMNS,
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
			}
		}
	});

	if (!profile) {
		throw new Error(`Profile with ID ${profileId} not found`);
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
	profile.references.forEach((ref, index) => translationMaps.reference.set(ref.id, index));
	// Same positional treatment as everything else the overlay can name: the
	// variant's translated wording has to survive the round trip, or a
	// re-imported profile prints English on every translated document.
	const exportedVariants = exportFieldVariants(
		profile.field_variants ?? [],
		translationMaps.workExperience
	);
	exportedVariants.forEach(({ id }, index) => translationMaps.fieldVariant.set(id, index));

	const translations = await buildTranslationExport(profileId, translationMaps);

	// Custom CV templates. The config is data the user built; its images are
	// media, so they follow the media switch.
	const { templates, assetPayloads: templateAssets } = await buildTemplateExport(
		profileId,
		includeMedia
	);

	// The media library: its originals are media, so it follows the same switch.
	// The slots below carry their rendition ids either way; without the library
	// an import has nothing to map them to and leaves the slots empty, as a
	// path without its file always did.
	const library = includeMedia ? await buildMediaLibraryExport(profileId) : null;
	const hasLibrary = !!library && library.library.items.length > 0;

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
		country_code: profile.country_code || undefined,
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
		city: profile.city || undefined,
		vat_id: profile.vat_id || undefined,
		kvk_number: profile.kvk_number || undefined,
		business_activities: profile.business_activities || undefined,
		profile_photo_id: profile.profile_photo_id || undefined,

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
			type: h.type || undefined,
			fa_icon: h.fa_icon || undefined,
			icon_name: h.icon_name || undefined
		})),

		tech_skill_categories: profile.tech_skill_categories.map((cat) => ({
			status: cat.status || undefined,
			sort: cat.sort,
			name: cat.name || undefined,
			note: cat.note || undefined,
			fa_icon: cat.fa_icon || undefined,
			tags: cat.tags,
			tech_skills: cat.tech_skills.map((skill) => ({
				status: skill.status || undefined,
				sort: skill.sort,
				name: skill.name || undefined,
				years_experience: skill.years_experience?.toString() || undefined,
				level: skill.level || undefined,
				tech_type: skill.tech_skill_type?.slug || null,
				tags: skill.tags
			}))
		})),

		work_experiences: profile.work_experiences.map((work) => ({
			name: work.name || undefined,
			location: work.location || undefined,
			work_mode: work.work_mode || undefined,
			position: work.position || undefined,
			headline: work.headline || undefined,
			description: work.description || undefined,
			summary: work.summary || undefined,
			status: work.status || undefined,
			sort: work.sort,
			start_date: formatDate(work.start_date),
			end_date: formatDate(work.end_date),
			website: work.website || undefined,
			tags: work.tags,
			featured: work.featured || undefined,
			featured_sort: work.featured_sort ?? undefined,
			logo_id: work.logo_id || undefined,
			banner_id: work.banner_id || undefined,
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
				name: t.name || undefined,
				tags: t.tags
			})),
			projects: work.work_experience_projects.map((p) => ({
				status: p.status || undefined,
				sort: p.sort,
				name: p.name || '',
				project_role: p.project_role || undefined,
				url: p.url || undefined,
				repo_url: p.repo_url || undefined,
				start_date: formatDate(p.start_date),
				end_date: formatDate(p.end_date),
				description: p.description || undefined,
				outcome: p.outcome || undefined,
				tags: p.tags,
				featured: p.featured || undefined,
				featured_sort: p.featured_sort ?? undefined,
				technologies: p.work_experience_project_technologies.map((t) => ({
					sort: t.sort,
					name: t.name || undefined,
					tags: t.tags
				}))
			}))
		})),

		side_projects: profile.side_projects.map((proj) => ({
			status: proj.status || undefined,
			sort: proj.sort,
			name: proj.name || undefined,
			project_role: proj.project_role || undefined,
			start_date: formatDate(proj.start_date),
			end_date: formatDate(proj.end_date),
			url: proj.url || undefined,
			stars: proj.stars,
			summary: proj.summary || undefined,
			repo_url: proj.repo_url || undefined,
			image_id: proj.image_id || undefined,
			banner_id: proj.banner_id || undefined,
			logo_id: proj.logo_id || undefined,
			tags: proj.tags,
			featured: proj.featured || undefined,
			featured_sort: proj.featured_sort ?? undefined,
			achievements: proj.side_project_achievements.map((a) => ({
				description: a.description || undefined,
				sort: a.sort
			})),
			technologies: proj.side_project_technologies.map((t) => ({
				sort: t.sort,
				name: t.name || undefined,
				tags: t.tags
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
			logo_id: edu.logo_id || undefined,
			banner_id: edu.banner_id || undefined,
			tags: edu.tags
		})),

		languages: profile.languages.map((l) => ({
			status: l.status || undefined,
			sort: l.sort,
			name: l.name || undefined,
			language_code: l.language_code || undefined,
			proficiency: l.proficiency || undefined
		})),

		field_variants: exportedVariants.map(({ exported }) => exported),

		references: profile.references.map((r) => ({
			status: r.status || undefined,
			sort: r.sort,
			author: r.author || undefined,
			author_position: r.author_position || undefined,
			author_email: r.author_email || undefined,
			author_phone: r.author_phone || undefined,
			text: r.text || undefined
		})),

		certificates: profile.certificates.map((c) => ({
			status: c.status || undefined,
			sort: c.sort,
			name: c.name || undefined,
			issuer: c.issuer || undefined,
			date: formatDate(c.date),
			expiry_date: formatDate(c.expiry_date),
			credential_id: c.credential_id || undefined,
			url: c.url || undefined,
			tags: c.tags,
			skills: c.certificate_skills.map((s) => ({
				sort: s.sort,
				name: s.name || undefined
			}))
		}))
	};

	const hasDocuments = Boolean(documents && documents.length > 0);

	const exportData: ProfileExportData = {
		version: '2.0',
		exported_at: new Date().toISOString(),
		scope: 'profile',
		has_media: hasLibrary,
		has_documents: hasDocuments,
		documents: hasDocuments ? documents : undefined,
		translations: translations.length > 0 ? translations : undefined,
		resume_templates: templates.length > 0 ? templates : undefined,
		media_library: hasLibrary ? library?.library : undefined,
		profile: profileData
	};

	return {
		data: exportData,
		documentFiles,
		templateAssets,
		libraryFiles: hasLibrary ? (library?.files ?? []) : []
	};
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

/**
 * The profile's alternative wordings as the payload carries them, each with the
 * id it had, in the order they are written.
 *
 * A role's wording travels with the role's POSITION in the payload, since no
 * database ids do. One whose role is not in the payload has nowhere to land on
 * the other side — read back without a role it would be taken for a field of
 * the profile and print nowhere — so it is left out HERE, before positions are
 * handed out. Skipping it later would leave a gap, and every translation of a
 * wording after it would point one place past its own.
 *
 * The id is returned beside each entry because the caller numbers the
 * translation overlay by this same order.
 */
export function exportFieldVariants(
	variants: {
		id: number;
		work_experience_id: number | null;
		field: string;
		label: string;
		value: string;
		note: string | null;
		sort: number | null;
	}[],
	/** Where each exported role sits in the payload's `work_experiences`, by its id. */
	workExperienceIndex: Map<number, number>
): { id: number; exported: ExportedFieldVariant }[] {
	return variants
		.filter((v) => v.work_experience_id === null || workExperienceIndex.has(v.work_experience_id))
		.map((v) => ({
			id: v.id,
			exported: {
				field: v.field,
				label: v.label,
				value: v.value,
				note: v.note || undefined,
				sort: v.sort,
				work_experience_index:
					v.work_experience_id === null ? undefined : workExperienceIndex.get(v.work_experience_id)
			}
		}));
}
