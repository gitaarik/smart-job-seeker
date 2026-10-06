/**
 * Profile export utilities
 * Handles exporting profile schema and data to collected_data collection
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { collected_data, profiles } from '$lib/server/db/schema';
import { isHiddenFromDocuments, PROFILE_ONLY_FLAG } from '$lib/profile-visibility';
import {
	normalizeAdjustments,
	storedEmployed,
	storedFreelance,
	type RegionAsks
} from '$lib/salary/settings';
import { compareAsks, employedYear, freelanceYear } from '$lib/salary/take-home';
import { getFxRates } from '$lib/server/salary/fx';

interface SchemaNode {
	note?: string;
	fields?: Record<string, string>;
	relations?: Record<string, SchemaNode>;
}

/**
 * The profile columns the snapshot selects, and — via the mapping below — the
 * profile fields the `${schema}` describes.
 *
 * One list because it was two, and the two could disagree in a direction
 * nothing reports: the mapping builds the schema every prompt is shown, the
 * query builds the `${data}` beside it, and a field named in the first but not
 * selected by the second tells the model about a field that is always empty.
 * That is the `education`/`educations` failure arriving from the other side,
 * and it is what adding `about_me_text` to the mapping alone actually did.
 *
 * Shaped as Drizzle's `columns` argument rather than an array of names because
 * the query infers its whole return type from this literal; an
 * `Object.fromEntries` in its place widens the row without erroring anywhere.
 */
const PROFILE_SNAPSHOT_COLUMNS = {
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
	about_me_text: true,
	nationality: true,
	location_url: true,
	location_timezone: true,
	/**
	 * The year they started working remotely, as a number.
	 *
	 * Here and not its two siblings (`dev_start_year`, `python_js_start_year`)
	 * because remote experience is the one of the three that is not already in
	 * the blob: how long someone has written code, and in what, is what
	 * `work_experiences` and `tech_skill_categories` say at length. Where they
	 * have done it from is said nowhere else, and the import suggester asked for
	 * it from the day it was written — against a snapshot that did not carry it,
	 * so it has never once been answered.
	 */
	remote_start_year: true,
	/**
	 * What the applicant asks to be paid: a salary and a freelance rate, each in
	 * its own unit, and the percentages that move them by job.
	 *
	 * Added 2026-09-22, when Phase 0 of profile memory measured the gap: asked
	 * "what do you think I charge?", the assistant answered confidently from
	 * numbers it found in past application negotiations, because neither salary
	 * store reached it. `salary_expectations` was retired the same day for
	 * reaching no prompt at all; these columns are the live store, edited on
	 * Salary Prep.
	 *
	 * They ship with what each ask comes to over a year, worked out the way the
	 * page does it, and a note on how to read them; see `withSalary`.
	 */
	salary_employed: true,
	salary_freelance: true,
	salary_adjustments: true
} as const;

/** Field names only, for the schema mapping and the test that pins the two together. */
export const PROFILE_SNAPSHOT_COLUMN_NAMES: string[] = Object.keys(PROFILE_SNAPSHOT_COLUMNS);

/**
 * Mapping of ExportedProfile structure to database collections and fields
 */
const PROFILE_SCHEMA_MAPPING = {
	profiles: {
		fields: PROFILE_SNAPSHOT_COLUMN_NAMES,
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
			/**
			 * In no snapshot until 2026-09-26, so no prompt had ever seen one: not
			 * the matcher, whatever the certificates page promised about scoring,
			 * and not a letter or an application answer asked about a certification.
			 * Whether one has lapsed is decided when a prompt is built, not here
			 * (see `markExpiredCertificates`).
			 */
			certificates: {
				fields: ['name', 'issuer', 'date', 'expiry_date', 'credential_id', 'url'],
				relations: {
					certificate_skills: {
						fields: ['name']
					}
				}
			},
			languages: {
				fields: ['name', 'language_code', 'proficiency']
			},
			references: {
				fields: ['author', 'author_position', 'author_email', 'author_phone', 'text']
			},
			project_stories: {
				fields: ['title', 'situation', 'task', 'action', 'result', 'reflection', 'category']
			},
			cheat_sheets: {
				fields: ['title', 'content']
			}
		}
	}
};

/**
 * Every top-level key `exportProfile` can put in `collected_data`.
 *
 * Exists so a prompt's `profileDataFields` list can be checked against it.
 * That list is a set-membership filter, so a name that is not one of these
 * keys reads as "the applicant has none" rather than as a typo: `education`
 * was in every generator's list for as long as they existed, against an export
 * that writes `educations`, and nothing anywhere said so. See
 * ai-chat/profile-fields.ts.
 */
export const EXPORTED_PROFILE_KEYS: readonly string[] = [
	...PROFILE_SCHEMA_MAPPING.profiles.fields,
	...Object.keys(PROFILE_SCHEMA_MAPPING.profiles.relations)
];

/**
 * The same set as `EXPORTED_PROFILE_KEYS`, as a type.
 *
 * The array can only be checked by a test that imports the list being checked,
 * and that is the gap `profileDataFields` kept falling through. The lists in
 * ai-chat/profile-fields.ts are pinned against it; the one the import suggester
 * declared inline at its call site was not, so `city`, `region`, `country_code`
 * and `remote_start_year` sat in it for as long as it existed, asking for four
 * keys the snapshot above did not carry and getting silence back.
 *
 * Annotating a field list with this moves the check to the compiler, where an
 * inline literal is no harder to catch than a named constant. Both halves stay:
 * the array is still what a runtime filter needs.
 */
export type ExportedProfileKey =
	| keyof typeof PROFILE_SNAPSHOT_COLUMNS
	| keyof (typeof PROFILE_SCHEMA_MAPPING)['profiles']['relations'];

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
 * How to read the salary columns, shipped beside them.
 *
 * A model handed `{"contract": 65}` read it as a rate rather than an uplift, and
 * the cost of that kind of misreading is a wrong number quoted to an employer.
 * The asks now say their own units, but the adjustments still need saying, and
 * so does what the yearly figures mean.
 *
 * It rides inside `salary_adjustments` rather than in a key of its own because
 * `ExportedProfileKey` is `keyof PROFILE_SNAPSHOT_COLUMNS`, and that union
 * being exactly the real columns is what stops a field list asking for
 * something the snapshot never writes. Enriching a value keeps the key honest.
 */
const SALARY_NOTE =
	'salary_employed is the salary they ask for a job, before tax, per its period ' +
	'(a monthly salary gets extraPayPct on top of twelve months: holiday pay, a ' +
	'13th month). salary_freelance is the rate they invoice as a freelancer, per ' +
	'its unit (a month means a fixed monthly fee). per_year is what each comes to ' +
	'in a year by their own assumptions; "kept" is take-home pay plus pension (and ' +
	"a job's benefits), the figure the two are compared on, and compared_with_salary " +
	'says which rate keeps the same as the salary and the reverse. The percentages ' +
	'below are added up across whichever of work_arrangement and company_type a job ' +
	'matches (employment_type only for a salary) and applied to that ask: ' +
	'ask * (1 + total / 100). A regions entry replaces the ask and its currency for ' +
	'jobs in that region, before the percentages. Quote these numbers rather than ' +
	'working your own, and show the multiplication when you adjust one.';

const roundOrNull = (n: number | null) => (n == null ? null : Math.round(n));

/**
 * Region rows with an amount. A row still left blank on the page holds 0 and
 * prices no job (`askForJob` skips it), so the note's "replaces the ask" would
 * have the assistant quote it as an ask of nothing.
 */
function pricedRegions(regions: RegionAsks): RegionAsks {
	return Object.fromEntries(Object.entries(regions).filter(([, ask]) => ask.amount > 0));
}

/** Whole units, so the blob says 67651 and not 67651.20000000001. */
function roundedYear<T extends Record<string, unknown>>(year: T): T {
	return Object.fromEntries(
		Object.entries(year).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v])
	) as T;
}

/**
 * The salary columns as the assistant reads them: each ask that has an amount,
 * with its yearly figures, the comparison when there are both, and the note.
 * An ask without an amount is left out, and with neither all three keys go,
 * since an absent key already reads as "they have none" to every consumer (see
 * EXPORTED_PROFILE_KEYS) and empty values spend blob on saying so.
 */
async function withSalary<T extends Record<string, unknown>>(profile: T): Promise<T> {
	const storedE = storedEmployed(profile.salary_employed);
	const storedF = storedFreelance(profile.salary_freelance);
	const employed = storedE?.amount != null ? storedE : null;
	const freelance = storedF?.amount != null ? storedF : null;

	const copy: Record<string, unknown> = { ...profile };
	delete copy.salary_employed;
	delete copy.salary_freelance;
	delete copy.salary_adjustments;
	if (!employed && !freelance) return copy as T;

	const needsRates = employed && freelance && employed.currency !== freelance.currency;
	const comparison =
		employed && freelance
			? compareAsks(employed, freelance, needsRates ? await getFxRates() : {})
			: null;
	const employedPerYear = employed && employedYear(employed);
	const freelancePerYear = freelance && freelanceYear(freelance);

	if (employed && employedPerYear) {
		copy.salary_employed = {
			...employed,
			regions: pricedRegions(employed.regions),
			per_year: roundedYear(employedPerYear)
		};
	}
	if (freelance && freelancePerYear) {
		copy.salary_freelance = {
			...freelance,
			regions: pricedRegions(freelance.regions),
			per_year: roundedYear(freelancePerYear),
			...(comparison && {
				compared_with_salary: {
					rate_keeping_the_same_as_the_salary: roundOrNull(comparison.breakEvenRate),
					salary_keeping_the_same_as_this_rate: roundOrNull(comparison.equivalentSalary),
					rate_above_that_by_pct: roundOrNull(
						comparison.rateVsBreakEven == null ? null : comparison.rateVsBreakEven * 100
					)
				}
			})
		};
	}
	copy.salary_adjustments = {
		note: SALARY_NOTE,
		...normalizeAdjustments(profile.salary_adjustments)
	};
	return copy as T;
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
		columns: PROFILE_SNAPSHOT_COLUMNS,
		with: {
			highlights: {
				columns: { text: true },
				orderBy: (t, { asc }) => asc(t.sort)
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
						orderBy: (t, { desc }) => desc(t.sort)
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
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
						orderBy: (t, { asc }) => asc(t.sort)
					},
					work_experience_technologies: {
						columns: { name: true },
						orderBy: (t, { asc }) => asc(t.sort)
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
								orderBy: (t, { asc }) => asc(t.sort)
							}
						},
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc, desc }) => [asc(t.sort), desc(t.start_date)]
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
						orderBy: (t, { asc }) => asc(t.sort)
					},
					side_project_technologies: {
						columns: { name: true },
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc, desc }) => [asc(t.sort), desc(t.start_date)]
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
				orderBy: (t, { asc }) => asc(t.sort)
			},
			certificates: {
				columns: {
					name: true,
					issuer: true,
					date: true,
					expiry_date: true,
					credential_id: true,
					url: true
				},
				with: {
					certificate_skills: {
						columns: { name: true },
						orderBy: (t, { asc }) => asc(t.sort)
					}
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			languages: {
				columns: {
					name: true,
					language_code: true,
					proficiency: true
				},
				orderBy: (t, { asc }) => asc(t.sort)
			},
			references: {
				columns: {
					author: true,
					author_position: true,
					author_email: true,
					author_phone: true,
					text: true
				},
				orderBy: (t, { asc }) => asc(t.sort)
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
				orderBy: (t, { asc }) => asc(t.sort)
			},
			cheat_sheets: {
				columns: {
					title: true,
					content: true
				},
				orderBy: (t, { asc }) => asc(t.sort)
			}
		}
	});

	if (!profile) return profile;

	return withSalary({
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
				isHiddenFromDocuments(tags as string[] | null)
					? { ...skill, [PROFILE_ONLY_FLAG]: true }
					: skill
			)
		}))
	});
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
