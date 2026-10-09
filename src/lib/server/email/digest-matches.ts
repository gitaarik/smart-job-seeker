/**
 * The matches an email digest sends: new since the last one, at or above the
 * profile's minimum score, best first. When Match Config says to hide jobs
 * paying below the ask, those are left out and counted instead, so the email
 * can say so: a digest that drops jobs without a word is one people stop
 * trusting.
 *
 * Shared by the worker's scheduled digest and the "send now" button, which
 * used to carry a copy of this query each.
 */

import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { job_matches, job_platforms, jobs } from '$lib/server/db/schema';
import { payFilterSql, readPayFilter } from '$lib/server/salary/pay-fit-store';
import { payVerdict } from '$lib/salary/pay-fit';
import type { DigestJob } from './digest';

export async function loadDigestMatches(
	profileId: number,
	opts: { minScore: number; since: Date; limit: number }
): Promise<{ jobs: DigestJob[]; belowAsk: number }> {
	const pay = await readPayFilter(profileId);
	const mode = pay.hideBelowAsk ? 'fit' : 'any';
	const ratio = sql`${job_matches.pay_ratio}`;
	const recent = and(
		eq(job_matches.profile_id, profileId),
		gte(job_matches.score, opts.minScore),
		gte(job_matches.date_created, opts.since)
	);

	const rows = await db
		.select({
			job_id: job_matches.job_id,
			score: job_matches.score,
			matched_skills: job_matches.matched_skills,
			pay_ratio: job_matches.pay_ratio,
			title: jobs.title,
			company: jobs.company,
			source_url: jobs.source_url,
			office_location: jobs.office_location,
			salary_min: jobs.salary_min,
			salary_max: jobs.salary_max,
			salary_currency: jobs.salary_currency,
			salary_period: jobs.salary_period,
			work_location: jobs.work_location,
			job_types: jobs.job_types,
			experience_levels: jobs.experience_levels,
			skills_required: jobs.skills_required,
			skills_preferred: jobs.skills_preferred,
			job_description: jobs.job_description,
			job_platform_name: job_platforms.name
		})
		.from(job_matches)
		.innerJoin(jobs, eq(job_matches.job_id, jobs.id))
		.leftJoin(job_platforms, eq(jobs.job_platform_id, job_platforms.id))
		.where(and(recent, payFilterSql(mode, pay.tolerancePct, ratio)))
		.orderBy(desc(job_matches.score))
		.limit(opts.limit);

	let belowAsk = 0;
	if (mode === 'fit') {
		const [row] = await db
			.select({ n: count() })
			.from(job_matches)
			.where(and(recent, payFilterSql('below', pay.tolerancePct, ratio)));
		belowAsk = row?.n ?? 0;
	}

	return {
		jobs: rows.map((m) => ({
			id: m.job_id,
			title: m.title ?? 'Untitled',
			company: m.company,
			score: m.score,
			source_url: m.source_url,
			office_location: m.office_location,
			salary_min: m.salary_min,
			salary_max: m.salary_max,
			salary_currency: m.salary_currency,
			salary_period: m.salary_period,
			pay: payVerdict(m.pay_ratio, pay.tolerancePct),
			work_location: m.work_location as string[] | null,
			job_types: m.job_types as string[] | null,
			experience_levels: m.experience_levels as string[] | null,
			skills_required: m.skills_required as string[] | null,
			skills_preferred: m.skills_preferred as string[] | null,
			matched_skills: m.matched_skills as string[] | null,
			job_description: m.job_description,
			job_platform_name: m.job_platform_name
		})),
		belowAsk
	};
}
