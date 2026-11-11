/**
 * The showcase's "Key skills" box, read from the profile's Skills: one line
 * per skill group the site shows, naming its first few skills in the
 * applicant's own order, under the group's icon.
 *
 * It used to be a list of its own, highlight rows of type `key_skill`, which
 * nothing in the app could create or even label as such. The one profile that
 * had any held a copy of the hard-coded box of the site it replaced, and it
 * went stale while the Skills page moved on. Reading the Skills keeps the box
 * current, gives it to every profile, and leaves what it says to the controls
 * the applicant already has there: the order, and each entry's Site switch.
 */

import type { Row } from './site-lists';

/** How many of a group's skills its line names. */
export const KEY_SKILLS_PER_LINE = 4;

export interface KeySkillLine {
	/** The group's id, unique among the lines. */
	key: number;
	text: string;
	/** The group's icon as stored, for `iconFor`; null for none. */
	icon: string | null;
}

/**
 * The skills a group's line names: its first named ones. Takes a group as
 * `siteLists` returns it, its skills already filtered for the site, so the
 * public page's data (portfolio-pages.ts) can keep exactly these and no more.
 */
export function lineSkills(category: Row): Row[] {
	return ((category.tech_skills ?? []) as Row[])
		.filter((skill) => String(skill.name ?? '').trim())
		.slice(0, KEY_SKILLS_PER_LINE);
}

/** One line per group, in the order of `siteLists`' `skillCategories`. */
export function keySkillLines(skillCategories: Row[]): KeySkillLine[] {
	return skillCategories
		.map((category) => ({
			key: category.id,
			text: lineSkills(category)
				.map((skill) => String(skill.name).trim())
				.join(', '),
			icon: category.fa_icon || null
		}))
		.filter((line) => line.text);
}
