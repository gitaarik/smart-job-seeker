import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
	findMatch: vi.fn(),
	findJob: vi.fn(),
	findConfig: vi.fn(),
	set: vi.fn(),
	where: vi.fn(),
	run: vi.fn(),
	evidence: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			job_matches: { findFirst: h.findMatch },
			jobs: { findFirst: h.findJob },
			match_config: { findFirst: h.findConfig }
		},
		update: () => ({
			set: (values: unknown) => {
				h.set(values);
				return { where: h.where };
			}
		})
	}
}));
vi.mock('$lib/server/documents/retrieval', () => ({
	relevantSupportingEvidence: h.evidence
}));
vi.mock('../job-utils', () => ({ runProfileAiChat: h.run }));
vi.mock('../profile-data', () => ({ NON_FIT_FIELDS: ['email_address'] }));

import {
	ensureMatchExplanation,
	factorLines,
	needsExplanation,
	skillsByMatch
} from '../match-explanation';
import { MATCH_SCORE_MODEL } from '../match-decisions';

const JEV_MATCH = {
	id: 3,
	score: 72,
	skip_reason: null,
	match_summary: null,
	strengths: null,
	gaps: null,
	matched_skills: ['Python', 'SQL'],
	score_factors: {
		model: MATCH_SCORE_MODEL,
		combined: 58,
		factors: {
			skills: { level: 3.2, levels: 5 },
			experience: { level: 2.9, levels: 4 },
			preferences: { level: 2, levels: 3 },
			career: { level: 1.1, levels: 3 },
			domain: { level: 0.2, levels: 3 }
		}
	}
};
const JOB = {
	id: 9,
	title: 'Backend Engineer',
	company: 'Acme',
	// What a scraper stores here: the board, not the employer.
	job_poster: 'Wellfound',
	office_location: null,
	job_types: ['full_time'],
	experience_levels: null,
	work_location: ['remote'],
	skills_required: ['Python', 'Kafka'],
	skills_preferred: ['sql'],
	job_description: 'Build services.',
	company_description: null
};
const WRITTEN = { summary: 'A solid fit.', strengths: ['Python'], gaps: ['Kafka'] };

beforeEach(() => {
	vi.clearAllMocks();
	h.findMatch.mockResolvedValue(JEV_MATCH);
	h.findJob.mockResolvedValue(JOB);
	h.findConfig.mockResolvedValue({
		job_types: ['Full-time'],
		experience_levels: null,
		work_location: ['Remote'],
		locations: null
	});
	h.evidence.mockResolvedValue('');
	h.run.mockResolvedValue({ success: true, message: 'ok', response: WRITTEN, aiChatId: 5 });
});

describe('match explanation', () => {
	it('is needed only by a scored match that has no text', () => {
		expect(needsExplanation({ skip_reason: null, match_summary: null })).toBe(true);
		// The prompt writes its text with the score, an empty summary included.
		expect(needsExplanation({ skip_reason: null, match_summary: '' })).toBe(false);
		expect(needsExplanation({ skip_reason: 'filtered_out', match_summary: null })).toBe(false);
	});

	it('lists the factor verdicts, or says there are none', () => {
		const lines = factorLines(JEV_MATCH.score_factors);
		expect(lines.split('\n')).toHaveLength(5);
		expect(lines).toContain(
			"- Technical skills: Most of the job's skills, including the core ones"
		);
		expect(factorLines(null)).toBe('- No breakdown was recorded for this score.');
	});

	it("splits the job's skills by whether the match credited them, ignoring case", () => {
		expect(skillsByMatch(JOB, ['Python', 'SQL'])).toEqual({
			shown: ['Python', 'SQL'],
			missing: ['Kafka']
		});
		expect(skillsByMatch({ skills_required: null, skills_preferred: 'x' }, null)).toEqual({
			shown: [],
			missing: []
		});
	});

	it('writes the text from the score and the verdicts, and stores it', async () => {
		await expect(ensureMatchExplanation(1, 9)).resolves.toEqual(WRITTEN);

		const [profileId, prompt, variables, options] = h.run.mock.calls[0];
		expect(profileId).toBe(1);
		expect(prompt).toBe('explain_job_match');
		expect(variables['match.score']).toBe('72');
		expect(variables['match.factors']).toContain('- Domain: ');
		expect(variables['match.matched_skills']).toBe('Python, SQL');
		expect(variables['match.missing_skills']).toBe('Kafka');
		expect(variables['preferences.work_location']).toBe('["Remote"]');
		expect(variables['job.company']).toBe('Acme');
		expect(Object.values(variables)).not.toContain('Wellfound');
		expect(options).toEqual({ profileDataExclude: ['email_address'] });
		expect(h.set).toHaveBeenCalledWith({
			match_summary: 'A solid fit.',
			strengths: ['Python'],
			gaps: ['Kafka']
		});
	});

	it('hands back stored text without writing any', async () => {
		h.findMatch.mockResolvedValue({
			...JEV_MATCH,
			match_summary: 'Stored.',
			strengths: ['a'],
			gaps: 'junk'
		});
		await expect(ensureMatchExplanation(1, 9)).resolves.toEqual({
			summary: 'Stored.',
			strengths: ['a'],
			gaps: []
		});
		expect(h.run).not.toHaveBeenCalled();
		expect(h.set).not.toHaveBeenCalled();
	});

	it('answers null when the profile has no match for the job', async () => {
		h.findMatch.mockResolvedValue(undefined);
		await expect(ensureMatchExplanation(1, 9)).resolves.toBeNull();
		expect(h.run).not.toHaveBeenCalled();
	});

	it('makes one call for two requests at once', async () => {
		const [a, b] = await Promise.all([ensureMatchExplanation(1, 9), ensureMatchExplanation(1, 9)]);
		expect(a).toEqual(WRITTEN);
		expect(b).toBe(a);
		expect(h.run).toHaveBeenCalledTimes(1);
	});

	it('throws, and stores nothing, when the text could not be written', async () => {
		h.run.mockResolvedValue({ success: false, message: 'rate limited', response: null });
		await expect(ensureMatchExplanation(1, 9)).rejects.toThrow('rate limited');
		expect(h.set).not.toHaveBeenCalled();
	});
});
