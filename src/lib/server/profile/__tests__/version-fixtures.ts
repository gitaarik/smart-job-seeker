/**
 * Profile shapes for the tailoring tests.
 *
 * `buildCandidates` runs the real document filter over whatever
 * `getProfileByIdentifier` returned, so a fixture that gets the nesting or the
 * tags wrong tests the fixture rather than the code. These builders keep the
 * shape in one place and leave the tags — the part every test is actually
 * about — to the caller.
 */

export interface FixtureBullet {
	id: number;
	description: string;
	tags: string[];
}

export interface FixtureRole {
	id: number;
	position: string;
	name: string;
	start_date: string | null;
	end_date: string | null;
	tags: string[];
	work_experience_achievements: FixtureBullet[];
}

export interface FixtureProject {
	id: number;
	name: string;
	summary: string;
	end_date: string | null;
	tags: string[];
}

export interface FixtureSkill {
	id: number;
	name: string;
	tags: string[];
}

export interface FixtureCategory {
	id: number;
	name: string;
	tags: string[];
	tech_skills: FixtureSkill[];
}

export interface FixtureVersion {
	id: number;
	slug: string;
	toggles: string[];
	extension_links: Array<{ extended_id: number | null }>;
	overrides: Array<{ entity_type: string; entity_id: number; action: string }>;
}

export function bullet(id: number, description: string, tags: string[] = []): FixtureBullet {
	return { id, description, tags };
}

export function role(
	id: number,
	position: string,
	achievements: FixtureBullet[] = [],
	over: Partial<FixtureRole> = {}
): FixtureRole {
	return {
		id,
		position,
		name: `Company ${id}`,
		start_date: '2018-01-01',
		end_date: null,
		tags: [],
		work_experience_achievements: achievements,
		...over
	};
}

export function project(
	id: number,
	name: string,
	over: Partial<FixtureProject> = {}
): FixtureProject {
	return { id, name, summary: `${name} does something`, end_date: null, tags: [], ...over };
}

export function skill(id: number, name: string, tags: string[] = []): FixtureSkill {
	return { id, name, tags };
}

export function category(
	id: number,
	name: string,
	skills: FixtureSkill[] = [],
	tags: string[] = []
): FixtureCategory {
	return { id, name, tags, tech_skills: skills };
}

export function version(
	id: number,
	slug: string,
	over: Partial<FixtureVersion> = {}
): FixtureVersion {
	return { id, slug, toggles: [], extension_links: [], overrides: [], ...over };
}

export interface ProfileFixture {
	id: number;
	work_experiences: FixtureRole[];
	side_projects: FixtureProject[];
	tech_skill_categories: FixtureCategory[];
	profile_versions: FixtureVersion[];
}

export function profileFixture(over: Partial<ProfileFixture> = {}): ProfileFixture {
	return {
		id: 1,
		work_experiences: [],
		side_projects: [],
		tech_skill_categories: [],
		profile_versions: [],
		...over
	};
}
