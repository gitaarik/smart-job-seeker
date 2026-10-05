/**
 * `job_poster` means two things depending on where the job came from: a typed
 * or parsed job holds the recruiter or agency, while a scraped one mostly
 * holds the platform's own name. Only the first is worth a row of its own.
 */
import { describe, expect, it } from 'vitest';
import { jobRecruiter } from '../format';

const job = (job_poster: string | null, company: string | null, platform?: string) => ({
	job_poster,
	company,
	job_platform: platform ? { name: platform } : null
});

describe('jobRecruiter', () => {
	it('names an agency or person presenting the role for a company', () => {
		expect(jobRecruiter(job('Rafael (BetaIT)', 'Applause'))).toBe('Rafael (BetaIT)');
		expect(jobRecruiter(job('Madelief Sibie', 'INTOS', 'LinkedIn'))).toBe('Madelief Sibie');
	});

	it('names the poster when the company is not known', () => {
		expect(jobRecruiter(job('Morgan Cioeta', null))).toBe('Morgan Cioeta');
	});

	it('skips the platform name a scraper stores as the poster', () => {
		expect(jobRecruiter(job('Wellfound', 'Deeply', 'Wellfound'))).toBeNull();
	});

	it('skips a poster that is the company itself', () => {
		expect(jobRecruiter(job('Mercor', 'Mercor', 'Mercor'))).toBeNull();
		expect(jobRecruiter(job('X-Team', 'X-Team'))).toBeNull();
	});

	it('skips an empty poster', () => {
		expect(jobRecruiter(job(null, 'Applause'))).toBeNull();
		expect(jobRecruiter(job('  ', 'Applause'))).toBeNull();
	});
});
