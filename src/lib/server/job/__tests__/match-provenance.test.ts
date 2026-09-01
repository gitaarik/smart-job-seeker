/**
 * How a match is attributed — the axis `matched_skills` could not express.
 *
 * The pure half (`attributeSkills`, `provenanceFor`, `matchExplanation`) is
 * tested directly. `profileReach` is tested through mocks for one reason only:
 * the closest-seed rule, which is the single place an ordering bug would be
 * invisible in production and wrong in a tooltip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const expandUpwardBySeed = vi.fn();
const getProfileSkillsRows = vi.fn();
const approvedAliasesOf = vi.fn();
const relatedTo = vi.fn();
const getProfileLanguageRows = vi.fn();

vi.mock('../skill-ontology', () => ({
	expandUpward: vi.fn(),
	expandUpwardBySeed: (...a: unknown[]) => expandUpwardBySeed(...a),
	approvedAliasesOf: (...a: unknown[]) => approvedAliasesOf(...a),
	relatedTo: (...a: unknown[]) => relatedTo(...a)
}));
// `getProfileSkills` runs two queries: tech skills join their category,
// languages hang straight off the profile. `from()` answers both shapes.
vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: () => ({
			from: () => ({
				innerJoin: () => ({ where: () => getProfileSkillsRows() }),
				where: () => getProfileLanguageRows()
			})
		})
	}
}));
vi.mock('$lib/server/db/schema', () => ({
	tech_skills: { name: 'name', category_id: 'category_id' },
	tech_skill_categories: { id: 'id', profile_id: 'profile_id' },
	languages: { name: 'name', proficiency: 'proficiency', profile_id: 'profile_id' }
}));

import { adjacentSkills, attributeSkills, profileReach, type ProfileReach } from '../match-utils';
import {
	adjacencyExplanation,
	adjacentFor,
	matchExplanation,
	provenanceFor
} from '$lib/match-provenance';

/** A reach built by hand, so attribution is tested without the database. */
function reachOf(
	own: string[],
	reached: Record<string, { seed: string; depth: number }>
): ProfileReach {
	const spelling = new Map<string, string>();
	for (const s of own) spelling.set(s.toLowerCase().replace(/[^a-z0-9+#]/g, ''), s);
	return {
		spelling,
		byReached: new Map(Object.entries(reached)),
		expanded: own,
		adjacent: new Map()
	};
}

/** A reach whose only content is a `related` hop — a gap, never a match. */
function adjacentReach(own: string[], adjacent: Record<string, { seed: string }>): ProfileReach {
	const r = reachOf(own, {});
	return { ...r, adjacent: new Map(Object.entries(adjacent)) };
}

describe('attributeSkills', () => {
	it('calls a skill the profile literally holds "literal", with no from', () => {
		const got = attributeSkills(reachOf(['MySQL'], {}), ['MySQL']);
		expect(got.get('MySQL')).toEqual({ skill: 'MySQL', via: 'literal', depth: 0 });
	});

	it('matches literally through normalization, not string equality', () => {
		const got = attributeSkills(reachOf(['Node.js'], {}), ['NodeJS']);
		expect(got.get('NodeJS')?.via).toBe('literal');
	});

	it('calls a depth-0 graph hit "alias" and names the spelling the profile used', () => {
		const got = attributeSkills(reachOf(['Vue.js'], { vue: { seed: 'vuejs', depth: 0 } }), ['Vue']);
		expect(got.get('Vue')).toEqual({ skill: 'Vue', via: 'alias', depth: 0, from: 'Vue.js' });
	});

	it('calls a real hop "ontology" and carries the depth', () => {
		const got = attributeSkills(reachOf(['MySQL'], { sql: { seed: 'mysql', depth: 1 } }), ['SQL']);
		expect(got.get('SQL')).toEqual({ skill: 'SQL', via: 'ontology', depth: 1, from: 'MySQL' });
	});

	it('omits a skill it cannot reach, so the caller can label the residue llm', () => {
		const got = attributeSkills(reachOf(['MySQL'], {}), ['Underwater Basket Weaving']);
		expect(got.has('Underwater Basket Weaving')).toBe(false);
	});

	it('prefers the literal reading when a skill is both held and reachable', () => {
		// Otherwise a pill would say "matched because you have SQL" to someone who
		// simply listed SQL.
		const got = attributeSkills(reachOf(['SQL'], { sql: { seed: 'mysql', depth: 1 } }), ['SQL']);
		expect(got.get('SQL')?.via).toBe('literal');
	});

	it('ignores a job skill that normalizes away', () => {
		expect(attributeSkills(reachOf(['SQL'], {}), ['—', '']).size).toBe(0);
	});
});

describe('profileReach', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		approvedAliasesOf.mockResolvedValue([]);
		relatedTo.mockResolvedValue([]);
		getProfileLanguageRows.mockResolvedValue([]);
	});

	it('credits the CLOSEST skill when two reach the same concept', async () => {
		getProfileSkillsRows.mockResolvedValue([{ name: 'React' }, { name: 'TypeScript' }]);
		expandUpwardBySeed.mockResolvedValue(
			new Map([
				['react', [{ slug: 'javascript', label: 'JavaScript', depth: 2 }]],
				['typescript', [{ slug: 'javascript', label: 'JavaScript', depth: 1 }]]
			])
		);
		const reach = await profileReach(1);
		// Not "because you have React" — TypeScript makes the shorter claim, and
		// row order must not decide which one the applicant is told.
		expect(reach.byReached.get('javascript')).toEqual({ seed: 'typescript', depth: 1 });
	});

	it('keeps the raw skills in `expanded`, not only what the graph knows', async () => {
		getProfileSkillsRows.mockResolvedValue([{ name: 'Caddy' }]);
		expandUpwardBySeed.mockResolvedValue(new Map());
		expect((await profileReach(1)).expanded).toEqual(['Caddy']);
	});

	it('survives a traversal failure with the skills intact', async () => {
		getProfileSkillsRows.mockResolvedValue([{ name: 'MySQL' }]);
		expandUpwardBySeed.mockRejectedValue(new Error('graph down'));
		const reach = await profileReach(1);
		expect(reach.expanded).toEqual(['MySQL']);
		expect(reach.byReached.size).toBe(0);
	});

	it('registers approved aliases as attribution keys AND as matchable spellings', async () => {
		getProfileSkillsRows.mockResolvedValue([{ name: 'React' }]);
		expandUpwardBySeed.mockResolvedValue(
			new Map([['react', [{ slug: 'react', label: 'React', depth: 0 }]]])
		);
		approvedAliasesOf.mockResolvedValue([{ alias: 'reactjs', slug: 'react' }]);
		const reach = await profileReach(1);
		// A job spelled "React.js" attributes...
		expect(reach.byReached.get('reactjs')).toEqual({ seed: 'react', depth: 0 });
		// ...and matches, because `getExpandedProfileSkills` emits it too and the
		// two lists must agree about what counts.
		expect(reach.expanded).toContain('reactjs');
		expect(reach.expanded).toContain('React');
	});

	it('does not let an alias shadow a concept that is reachable in its own right', async () => {
		getProfileSkillsRows.mockResolvedValue([{ name: 'React' }]);
		expandUpwardBySeed.mockResolvedValue(
			new Map([
				[
					'react',
					[
						{ slug: 'react', label: 'React', depth: 0 },
						{ slug: 'frontend', label: 'Frontend', depth: 1 }
					]
				]
			])
		);
		approvedAliasesOf.mockResolvedValue([{ alias: 'frontend', slug: 'react' }]);
		expect((await profileReach(1)).byReached.get('frontend')).toEqual({
			seed: 'react',
			depth: 1
		});
	});
});

describe('provenanceFor', () => {
	const blob = [{ skill: 'SQL', via: 'ontology', depth: 1, from: 'MySQL' }];

	it('reads a hit out of the jsonb column', () => {
		expect(provenanceFor(blob, 'SQL')).toEqual({ via: 'ontology', from: 'MySQL' });
	});

	it('returns null for a row scored before the column existed', () => {
		expect(provenanceFor(null, 'SQL')).toBeNull();
		expect(provenanceFor(undefined, 'SQL')).toBeNull();
	});

	it('returns null rather than throwing on a shape it does not recognise', () => {
		expect(provenanceFor({ nope: true }, 'SQL')).toBeNull();
		expect(provenanceFor([null, 'x'], 'SQL')).toBeNull();
	});

	it('returns null for a skill the blob does not mention', () => {
		expect(provenanceFor(blob, 'Rust')).toBeNull();
	});
});

describe('matchExplanation', () => {
	it('says nothing for a literal match', () => {
		expect(matchExplanation('literal', null)).toBeNull();
	});

	it('says nothing when it cannot name the skill it came from', () => {
		expect(matchExplanation('ontology', null)).toBeNull();
		expect(matchExplanation('alias', null)).toBeNull();
	});

	it('names the reaching skill for a graph match', () => {
		expect(matchExplanation('ontology', 'MySQL')).toBe('Matched because you have MySQL');
	});

	it('flags an LLM guess as the guess it is', () => {
		expect(matchExplanation('llm', null)).toMatch(/not an exact skill match/);
	});
});

describe('adjacentSkills', () => {
	const reach = adjacentReach(['Docker'], { kubernetes: { seed: 'docker' } });

	it('names a held skill one related hop from an unmatched requirement', () => {
		expect(adjacentSkills(reach, ['Kubernetes'], new Set())).toEqual([
			{ skill: 'Kubernetes', from: 'Docker' }
		]);
	});

	it('says nothing about a skill that already matched', () => {
		// Otherwise a pill would offer a consolation prize for something the
		// applicant was just credited with.
		expect(adjacentSkills(reach, ['Kubernetes'], new Set(['Kubernetes']))).toEqual([]);
	});

	it('says nothing when no held skill is related', () => {
		expect(adjacentSkills(reach, ['COBOL'], new Set())).toEqual([]);
	});

	it('does not put adjacency anywhere a match would be read from', () => {
		// The guarantee the whole design rests on: Docker must not make Kubernetes
		// look matched.
		expect(attributeSkills(reach, ['Kubernetes']).size).toBe(0);
		expect(reach.expanded).not.toContain('Kubernetes');
	});
});

describe('profileReach adjacency', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		approvedAliasesOf.mockResolvedValue([]);
		expandUpwardBySeed.mockResolvedValue(new Map());
	});

	it('collects the related hop without widening `expanded` or `byReached`', async () => {
		getProfileSkillsRows.mockResolvedValue([{ name: 'Docker' }]);
		relatedTo.mockResolvedValue([{ seed: 'docker', slug: 'kubernetes', label: 'Kubernetes' }]);
		const reach = await profileReach(1);
		expect(reach.adjacent.get('kubernetes')).toEqual({ seed: 'docker' });
		expect(reach.expanded).toEqual(['Docker']);
		expect(reach.byReached.size).toBe(0);
	});

	it('leaves gaps unannotated rather than failing when the hop is unavailable', async () => {
		getProfileSkillsRows.mockResolvedValue([{ name: 'Docker' }]);
		relatedTo.mockRejectedValue(new Error('graph down'));
		const reach = await profileReach(1);
		expect(reach.adjacent.size).toBe(0);
		expect(reach.expanded).toEqual(['Docker']);
	});
});

describe('adjacentFor / adjacencyExplanation', () => {
	it('reads the held skill out of the jsonb column', () => {
		expect(adjacentFor([{ skill: 'Kubernetes', from: 'Docker' }], 'Kubernetes')).toBe('Docker');
	});

	it('returns null on an old row, a bad shape, or an absent skill', () => {
		expect(adjacentFor(null, 'Kubernetes')).toBeNull();
		expect(adjacentFor({ nope: 1 }, 'Kubernetes')).toBeNull();
		expect(adjacentFor([{ skill: 'Kubernetes', from: 'Docker' }], 'Rust')).toBeNull();
	});

	it('stops short of claiming the applicant has the skill', () => {
		const text = adjacencyExplanation('Docker');
		expect(text).toBe("You don't have this, but you have Docker, which is related");
		expect(adjacencyExplanation(null)).toBeNull();
	});
});
