/**
 * The digest email's pay parts: the badge on a job and the line saying how
 * many jobs it left out for paying below the ask. A digest that drops jobs
 * without saying so is the failure the line exists to prevent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent: { html: string; metadata: unknown }[] = [];
vi.mock('../index', () => ({
	sendEmail: vi.fn(async (msg: { html: string; metadata: unknown }) => {
		sent.push(msg);
	})
}));

const { sendDigestEmail } = await import('../digest');
type DigestJob = Parameters<typeof sendDigestEmail>[0]['jobs'][number];

function job(fields: Partial<DigestJob>): DigestJob {
	return {
		id: 1,
		title: 'Backend Developer',
		company: 'Acme',
		score: 88,
		source_url: null,
		office_location: null,
		salary_min: 80000,
		salary_max: 95000,
		salary_currency: 'EUR',
		salary_period: 'year',
		pay: null,
		work_location: null,
		job_types: null,
		experience_levels: null,
		skills_required: null,
		skills_preferred: null,
		matched_skills: null,
		job_description: null,
		job_platform_name: null,
		...fields
	};
}

const BASE = { to: 'a@example.com', profileName: 'Alex', minScore: 70, appUrl: 'https://app' };

beforeEach(() => {
	sent.length = 0;
});

describe('sendDigestEmail', () => {
	it('says how many jobs it left out for paying below the ask, and links to them', async () => {
		await sendDigestEmail({ ...BASE, jobs: [job({})], belowAsk: 3 });
		expect(sent[0].html).toContain('3 more paying below your ask were left out.');
		expect(sent[0].html).toContain('https://app/jobs?minScore=70&amp;pay=below');
		expect(sent[0].metadata).toMatchObject({ belowAsk: 3 });
	});

	it('says nothing about pay when nothing was left out', async () => {
		await sendDigestEmail({ ...BASE, jobs: [job({})], belowAsk: 0 });
		expect(sent[0].html).not.toContain('below your ask');
	});

	it('puts the pay badge next to the salary, and none without a verdict', async () => {
		await sendDigestEmail({
			...BASE,
			jobs: [job({ id: 1, pay: 'meets' }), job({ id: 2, pay: null })]
		});
		expect(sent[0].html.match(/Meets your ask/g)).toHaveLength(1);
	});
});
