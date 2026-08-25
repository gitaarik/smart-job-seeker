import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearParseCache, parseCacheKey, recallParse, rememberParse } from '../parse-cache';
import type { ParsedJobDescription } from '../parse-job-description';

function makeParsed(title: string): ParsedJobDescription {
	return {
		title,
		suggested_title: null,
		job_description: null,
		company_description: null,
		company: null,
		job_poster: null,
		date_posted: null,
		location: null,
		remote: null,
		experience_levels: null,
		job_type: null,
		salary_min: null,
		salary_max: null,
		salary_currency: null,
		salary_period: null,
		salary_duration_weeks: null,
		skills_required: null,
		skills_preferred: null,
		responsibilities: null,
		soft_skills: null,
		status: null,
		source_url: null,
		source_html_stripped: '',
		ai_chat_extraction: null
	};
}

describe('parse-cache', () => {
	beforeEach(() => {
		clearParseCache();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('parseCacheKey', () => {
		it('is stable for the same profile and description', () => {
			expect(parseCacheKey(7, 'a posting')).toBe(parseCacheKey(7, 'a posting'));
		});

		// The key doubles as the parse token the create action validates, so any
		// change to the description must invalidate it.
		it('changes when the description changes', () => {
			expect(parseCacheKey(7, 'a posting')).not.toBe(parseCacheKey(7, 'a posting '));
		});

		// A token minted for one profile must never resolve for another.
		it('changes when the profile changes', () => {
			expect(parseCacheKey(7, 'a posting')).not.toBe(parseCacheKey(8, 'a posting'));
		});

		it('does not collide across the profile/description boundary', () => {
			expect(parseCacheKey(1, '2 x')).not.toBe(parseCacheKey(12, ' x'));
		});
	});

	it('recalls a stored parse', () => {
		const key = parseCacheKey(1, 'posting');
		rememberParse(key, makeParsed('Engineer'));
		expect(recallParse(key)?.title).toBe('Engineer');
	});

	it('returns null for an unknown key', () => {
		expect(recallParse(parseCacheKey(1, 'never parsed'))).toBeNull();
	});

	it('expires entries after the TTL', () => {
		vi.useFakeTimers();
		const key = parseCacheKey(1, 'posting');
		rememberParse(key, makeParsed('Engineer'));

		vi.advanceTimersByTime(29 * 60 * 1000);
		expect(recallParse(key)).not.toBeNull();

		vi.advanceTimersByTime(2 * 60 * 1000);
		expect(recallParse(key)).toBeNull();
	});

	it('evicts the oldest entries once over the cap', () => {
		const first = parseCacheKey(1, 'posting 0');
		for (let i = 0; i < 260; i++) {
			rememberParse(parseCacheKey(1, `posting ${i}`), makeParsed(`Job ${i}`));
		}
		// The oldest is gone; the most recent survives.
		expect(recallParse(first)).toBeNull();
		expect(recallParse(parseCacheKey(1, 'posting 259'))?.title).toBe('Job 259');
	});
});
