/**
 * Profile export utilities
 * Handles exporting profile schema and data to collected_data collection
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { collected_data, profiles } from '$lib/server/db/schema';
import removeMd from 'remove-markdown';
import { isProfileOnly, PROFILE_ONLY_FLAG } from '$lib/profile-visibility';

interface SchemaNode {
	note?: string;
	fields?: Record<string, string>;
	relations?: Record<string, SchemaNode>;
}

/**
 * Mapping of ExportedProfile structure to database collections and fields
 */
const PROFILE_SCHEMA_MAPPING = {
	profiles: {
		fields: [
			'name',
			'title',
			'location',
			'phone_number',
			'email_address',
			'personal_website',
			'subtitle',
			'core_stack',
			'linkedin_profile',
			'github_profile',
			'stackoverflow_profile',
			'headline',
			'summary',
			'nationality',
			'location_url',
			'location_timezone'
		],
		relations: {
			highlights: {
				fields: ['text']
			},
			tech_skill_categories: {
				fields: ['name'],
				relations: {
					tech_skills: {
						fields: ['name', 'years_experience', 'level']
					}
				}
			},
			work_experiences: {
				fields: ['name', 'location', 'position', 'summary', 'start_date', 'end_date', 'website'],
				relations: {
					work_experience_achievements: {
						fields: ['description']
					},
					work_experience_technologies: {
						fields: ['name']
					},
					work_experience_projects: {
						fields: ['name', 'url', 'start_date', 'end_date', 'description', 'outcome'],
						relations: {
							work_experience_project_technologies: {
								fields: ['name']
							}
						}
					}
				}
			},
			side_projects: {
				fields: ['name', 'start_date', 'end_date', 'url', 'stars', 'summary', 'repo_url'],
				relations: {
					side_project_achievements: {
						fields: ['description']
					},
					side_project_technologies: {
						fields: ['name']
					}
				}
			},
			educations: {
				fields: [
					'institution',
					'location',
					'url',
					'area',
					'study_type',
					'graduation_year',
					'start_date',
					'end_date',
					'summary'
				]
			},
			languages: {
				fields: ['name', 'language_code', 'proficiency']
			},
			references: {
				fields: ['author', 'author_position', 'text']
			},
			project_stories: {
				fields: ['title', 'situation', 'task', 'action', 'result', 'reflection', 'category']
			},
			cheat_sheets: {
				fields: ['title', 'content']
			},
			salary_expectations: {
				fields: [
					'job_title',
					'company_type',
					'employment_type',
					'work_arrangement',
					'experience_level',
					'region',
					'hourly_rate',
					'month_salary',
					'year_salary',
					'daily_rate'
				]
			}
		}
	}
};

/**
 * Build a schema node with field notes
 */
function buildSchemaNode(
	collection: string,
	fieldNames: string[],
	relations?: Record<string, { fields: string[]; relations?: Record<string, unknown> }>
): SchemaNode {
	const node: SchemaNode = {
		fields: {}
	};

	for (const fieldName of fieldNames) {
		node.fields![fieldName] = '';
	}

	if (relations && Object.keys(relations).length > 0) {
		node.relations = {};
		for (const [relationName, relationConfig] of Object.entries(relations)) {
			node.relations[relationName] = buildSchemaNode(
				relationName,
				relationConfig.fields,
				relationConfig.relations as Record<string, { fields: string[] }>
			);
		}
	}

	return node;
}

/**
 * Fetch complete profile data with all relations
 * Internal helper function used by exportProfile
 *
 * Profile-only skills are marked here, not dropped. They exist so jobs keep
 * matching on a skill the applicant would rather not put on paper (see
 * $lib/profile-visibility), and this one snapshot feeds *every* prompt — both
 * the cover letter that must not claim them and the `score_job_match` call that
 * must. Dropping them at this layer silently cost them the second: a job would
 * list a skill the applicant had just added and the analysis would report it as
 * a gap. Consumers resolve the distinction (ai-chat/profile-data.ts).
 */
async function fetchProfileData(profileId: number) {
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: {
			name: true,
			title: true,
			location: true,
			phone_number: true,
			email_address: true,
			personal_website: true,
			subtitle: true,
			core_stack: true,
			linkedin_profile: true,
			github_profile: true,
			stackoverflow_profile: true,
			headline: true,
			summary: true,
			nationality: true,
			location_url: true,
			location_timezone: true
		},
		with: {
			highlights: {
				columns: { text: true },
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			tech_skill_categories: {
				columns: { name: true },
				with: {
					tech_skills: {
						columns: {
							name: true,
							years_experience: true,
							level: true,
							tags: true
						},
						orderBy: (t: any, { desc }: any) => desc(t.sort)
					}
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			work_experiences: {
				columns: {
					name: true,
					location: true,
					position: true,
					summary: true,
					start_date: true,
					end_date: true,
					website: true
				},
				with: {
					work_experience_achievements: {
						columns: { description: true },
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					},
					work_experience_technologies: {
						columns: { name: true },
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					},
					work_experience_projects: {
						columns: {
							name: true,
							url: true,
							start_date: true,
							end_date: true,
							description: true,
							outcome: true
						},
						with: {
							work_experience_project_technologies: {
								columns: { name: true },
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
					name: true,
					start_date: true,
					end_date: true,
					url: true,
					stars: true,
					summary: true,
					repo_url: true
				},
				with: {
					side_project_achievements: {
						columns: { description: true },
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					},
					side_project_technologies: {
						columns: { name: true },
						orderBy: (t: any, { asc }: any) => asc(t.sort)
					}
				},
				orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)]
			},
			educations: {
				columns: {
					institution: true,
					location: true,
					url: true,
					area: true,
					study_type: true,
					graduation_year: true,
					start_date: true,
					end_date: true,
					summary: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			languages: {
				columns: {
					name: true,
					language_code: true,
					proficiency: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			references: {
				columns: {
					author: true,
					author_position: true,
					text: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			project_stories: {
				columns: {
					title: true,
					situation: true,
					task: true,
					action: true,
					result: true,
					reflection: true,
					category: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			cheat_sheets: {
				columns: {
					title: true,
					content: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			},
			salary_expectations: {
				columns: {
					job_title: true,
					company_type: true,
					employment_type: true,
					work_arrangement: true,
					experience_level: true,
					region: true,
					hourly_rate: true,
					month_salary: true,
					year_salary: true,
					daily_rate: true
				},
				orderBy: (t: any, { asc }: any) => asc(t.sort)
			}
		}
	});

	if (!profile) return profile;

	return {
		...profile,
		tech_skill_categories: profile.tech_skill_categories.map((category) => ({
			...category,
			// Held back from documents is not the same as absent. This snapshot is
			// shared by every prompt, including the one that scores job matches, and
			// dropping these here made a profile-only skill invisible to matching —
			// the single thing it exists to do. So mark, and let each consumer
			// decide: see applySkillVisibility in ai-chat/profile-data.ts.
			//
			// `tags` itself is a visibility mechanism, not profile content, so the
			// prompts never see it either way.
			tech_skills: category.tech_skills.map(({ tags, ...skill }) =>
				isProfileOnly(tags as string[] | null) ? { ...skill, [PROFILE_ONLY_FLAG]: true } : skill
			)
		}))
	};
}

/**
 * Export both profile schema and data
 * Uses parallel execution and single atomic database operation for better performance
 */
export async function exportProfile(profileId: number): Promise<{
	success: boolean;
	message: string;
}> {
	try {
		// Verify profile exists
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { id: true }
		});

		if (!profile) {
			return {
				success: false,
				message: `Profile with ID ${profileId} not found`
			};
		}

		// PARALLEL EXECUTION - Fetch schema and data simultaneously
		const profilesConfig = PROFILE_SCHEMA_MAPPING.profiles;
		const [schema, data] = await Promise.all([
			buildSchemaNode(
				'profiles',
				profilesConfig.fields,
				profilesConfig.relations as Record<string, { fields: string[] }>
			),
			fetchProfileData(profileId)
		]);

		// SINGLE DATABASE OPERATION - Update both fields atomically
		const existingCollectedData = await db.query.collected_data.findFirst({
			where: eq(collected_data.profile_id, profileId)
		});

		if (existingCollectedData) {
			await db
				.update(collected_data)
				.set({
					schema: JSON.stringify(schema, null, 2),
					data: JSON.stringify(data, null, 2),
					date_updated: new Date()
				})
				.where(eq(collected_data.id, existingCollectedData.id));
		} else {
			await db.insert(collected_data).values({
				profile_id: profileId,
				schema: JSON.stringify(schema, null, 2),
				data: JSON.stringify(data, null, 2),
				date_updated: new Date()
			});
		}

		return {
			success: true,
			message: `Profile schema and data exported for profile ID ${profileId}`
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return {
			success: false,
			message: `Error exporting profile: ${errorMessage}`
		};
	}
}
