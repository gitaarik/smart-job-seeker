import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, asc } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';

interface ExportedProfile {
	profile: {
		name?: string;
		title?: string;
		location?: string;
		phone_number?: string;
		email_address?: string;
		personal_website?: string;
		subtitle?: string;
		core_stack?: string;
		linkedin_profile?: string;
		github_profile?: string;
		stackoverflow_profile?: string;
		headline?: string;
		summary?: string;
		nationality?: string;
		location_url?: string;
		location_timezone?: string;
		profile_versions: Array<any>;
		highlights: Array<any>;
		tech_skill_categories: Array<any>;
		work_experiences: Array<any>;
		side_projects: Array<any>;
		education: Array<any>;
		languages: Array<any>;
		references: Array<any>;
		project_stories: Array<any>;
		application_questions?: Array<any>;
		cheat_sheets: Array<any>;
		salary_settings?: {
			base_rate?: number | null;
			currency?: string;
			adjustments?: Record<string, Record<string, number>>;
			region_overrides?: Record<string, number>;
		};
	};
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');

	// Verify ownership
	const profileCheck = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, user.id)),
		columns: { id: true }
	});

	if (!profileCheck) {
		throw error(403, 'Access denied');
	}

	// Fetch profile with all relations using Drizzle relational queries
	const baseProfile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		with: {
			profile_versions: {
				columns: {
					status: true,
					sort: true,
					slug: true,
					name: true,
					toggles: true
				},
				with: {
					extension_links: {
						columns: {},
						with: {
							extended: {
								columns: {
									slug: true
								}
							}
						}
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			highlights: {
				columns: { status: true, sort: true, text: true, fa_icon: true },
				orderBy: (t, { asc }) => asc(t.sort)
			},
			tech_skill_categories: {
				columns: {
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
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			work_experiences: {
				columns: {
					id: true,
					name: true,
					location: true,
					description: true,
					position: true,
					summary: true,
					status: true,
					sort: true,
					start_date: true,
					end_date: true,
					website: true,
					tags: true
				},
				with: {
					work_experience_achievements: {
						columns: {
							status: true,
							sort: true,
							description: true,
							fa_icon: true,
							tags: true
						},
						orderBy: (t, { asc }) => asc(t.sort)
					},
					work_experience_technologies: {
						columns: { status: true, sort: true, name: true },
						orderBy: (t, { asc }) => asc(t.sort)
					},
					work_experience_projects: {
						columns: {
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
								orderBy: (t, { asc }) => asc(t.sort)
							}
						},
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
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
					tags: true
				},
				with: {
					side_project_achievements: {
						columns: {
							description: true,
							sort: true
						},
						orderBy: (t, { asc }) => asc(t.sort)
					},
					side_project_technologies: {
						columns: { sort: true, name: true },
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			educations: {
				columns: {
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
					tags: true
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			languages: {
				columns: {
					status: true,
					sort: true,
					name: true,
					language_code: true,
					proficiency: true
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			references: {
				columns: {
					status: true,
					sort: true,
					author: true,
					author_position: true,
					text: true
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			project_stories: {
				columns: {
					sort: true,
					title: true,
					situation: true,
					task: true,
					action: true,
					result: true,
					reflection: true,
					category: true
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			cheat_sheets: {
				columns: { sort: true, title: true, content: true },
				orderBy: (t, { asc }) => asc(t.sort)
			}
		}
	});

	if (!baseProfile) {
		throw error(404, `Profile with ID ${profileId} not found`);
	}

	// Build the export object
	const exportData: ExportedProfile = {
		profile: {
			name: baseProfile.name || undefined,
			title: baseProfile.title || undefined,
			location: baseProfile.location || undefined,
			phone_number: baseProfile.phone_number || undefined,
			email_address: baseProfile.email_address || undefined,
			personal_website: baseProfile.personal_website || undefined,
			subtitle: baseProfile.subtitle || undefined,
			core_stack: baseProfile.core_stack || undefined,
			linkedin_profile: baseProfile.linkedin_profile || undefined,
			github_profile: baseProfile.github_profile || undefined,
			stackoverflow_profile: baseProfile.stackoverflow_profile || undefined,
			headline: baseProfile.headline || undefined,
			summary: baseProfile.summary || undefined,
			nationality: baseProfile.nationality || undefined,
			location_url: baseProfile.location_url || undefined,
			location_timezone: baseProfile.location_timezone || undefined,
			profile_versions: baseProfile.profile_versions.map((pv) => ({
				status: pv.status || undefined,
				sort: pv.sort,
				slug: pv.slug || undefined,
				name: pv.name || undefined,
				toggles: pv.toggles,
				extends_from: pv.extension_links?.[0]?.extended?.slug
			})),
			highlights: baseProfile.highlights,
			tech_skill_categories: baseProfile.tech_skill_categories.map((cat) => ({
				status: cat.status || undefined,
				sort: cat.sort,
				name: cat.name || undefined,
				fa_icon: cat.fa_icon || undefined,
				tech_skills: cat.tech_skills.map((skill) => ({
					status: skill.status || undefined,
					sort: skill.sort,
					name: skill.name || undefined,
					years_experience: skill.years_experience || undefined,
					level: skill.level || undefined,
					tech_type: skill.tech_skill_type?.slug || null
				}))
			})),
			work_experiences: baseProfile.work_experiences.map((work) => ({
				name: work.name || undefined,
				location: work.location || undefined,
				description: work.description || undefined,
				position: work.position || undefined,
				summary: work.summary || undefined,
				status: work.status || undefined,
				sort: work.sort,
				start_date: work.start_date,
				end_date: work.end_date,
				website: work.website || undefined,
				tags: work.tags,
				achievements: work.work_experience_achievements,
				technologies: work.work_experience_technologies,
				projects: work.work_experience_projects
			})),
			side_projects: baseProfile.side_projects.map((proj) => ({
				status: proj.status || undefined,
				sort: proj.sort,
				name: proj.name || undefined,
				start_date: proj.start_date,
				end_date: proj.end_date,
				url: proj.url || undefined,
				stars: proj.stars,
				summary: proj.summary || undefined,
				repo_url: proj.repo_url || undefined,
				tags: proj.tags,
				achievements: proj.side_project_achievements,
				technologies: proj.side_project_technologies
			})),
			education: baseProfile.educations,
			languages: baseProfile.languages,
			references: baseProfile.references,
			project_stories: baseProfile.project_stories,
			cheat_sheets: baseProfile.cheat_sheets,
			salary_settings: baseProfile.salary_base_rate
				? {
						base_rate: baseProfile.salary_base_rate,
						currency: baseProfile.salary_currency ?? 'EUR',
						adjustments: baseProfile.salary_adjustments as
							Record<string, Record<string, number>> | undefined,
						region_overrides: baseProfile.salary_region_overrides as
							Record<string, number> | undefined
					}
				: undefined
		}
	};

	const profileName = baseProfile.name?.replace(/\s+/g, '-').toLowerCase() || 'profile';

	return json(exportData, {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="profile-${profileId}.json"`,
			'Cache-Control': 'no-cache'
		}
	});
};
