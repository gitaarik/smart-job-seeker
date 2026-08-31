/**
 * Re-extract skills for jobs whose extraction returned nothing.
 *
 * `extract_job_data` used to describe its two skill fields as "REQUIRED
 * TECHNICAL skills/technologies" and keyed extraction on explicit markers
 * ("Requirements", "Must have"). A posting that states what it wants in running
 * prose — public-sector, NGO, research, clinical, consultancy — matched neither,
 * so the fields came back empty. Measured on preview run 1449 (Impactpool,
 * "sustainable"): 60 of 107 jobs had no skills at all from descriptions
 * averaging 2,500 characters. The prompt is fixed; these rows are not, because
 * the scraper only extracts on insert.
 *
 * Nothing is re-fetched. The stored description is the same text the extraction
 * saw the first time, so this is the prompt change applied to the input it was
 * always given, at one LLM call per job and no browser.
 *
 *   docker compose exec app node dist-scripts/backfill-job-skills.mjs
 *   docker compose exec app node dist-scripts/backfill-job-skills.mjs --apply
 *   docker compose exec app node dist-scripts/backfill-job-skills.mjs --apply --limit 25
 *   docker compose exec app node dist-scripts/backfill-job-skills.mjs --apply --profile 58
 *
 * Dry-run by default: it prints what each job WOULD get, having made the calls,
 * and writes nothing. That costs the same as `--apply` — the point is to read
 * the extractions before they land, not to save tokens.
 *
 * ## Why this writes four fields and the staff Re-parse writes twenty
 *
 * `reparseAndRescore` in `routes/(app)/jobs/[id]/+page.server.ts` overwrites
 * every parser-owned field, which is right for one row a human is looking at
 * and wrong for a sweep of several hundred. Two of those fields are
 * `date_posted` and `office_location`, and the scraper's duplicate check is
 * `title + job_poster + date_posted + office_location` (`job-data.ts:240-250`).
 * Rewriting them in bulk would silently re-key rows the importer uses to
 * recognise what it has already seen, so the next run of every affected task
 * would import its jobs a second time. A backfill that creates duplicates is
 * worse than the gap it closes.
 *
 * So this only fills what was empty, and only the four fields the failure is
 * about. A job that already has skills is never touched — which is also what
 * makes it safe to re-run.
 *
 * ## `source_html_stripped` is not always this job's page
 *
 * The staff Re-parse prefers the captured HTML over the description, on the
 * grounds that the captured page is the richest input a scraped job has. That
 * is true when the capture is a job DETAIL page. It is false when the scraper
 * captured the search results, and on dev that is the common case: jobs 1406,
 * 1407, 1410 and 1415 each carry 17-20k characters of stripped HTML holding
 * every card on the page, against a `job_description` of 0-503.
 *
 * A first dry run took the HTML and got exactly what that implies — "Rust SWEs
 * (Junior Onwards)" came back with *Financial Advisory*, "Personal Financial
 * Advisors" with *Visual Studio Code, Android Studio, Quartus, VMware*. The
 * model picked a card, and nothing in the output said which one. Written to 248
 * rows that is invisible corruption: plausible skills, wrong job, and no way
 * afterwards to tell which rows are wrong.
 *
 * Three defences, in order:
 *
 * 1. **Prefer `job_description`.** It is this job's text by construction. The
 *    captured HTML is only a fallback, for rows whose description is too thin
 *    to parse.
 * 2. **Anchor the fallback.** When the HTML is used it is passed with a
 *    `searchContext` naming this job's title, company and location — the same
 *    hint the scraper passes for the same reason (`parse-job-description.ts`
 *    § buildSearchContextHint).
 * 3. **Check the answer came back about the right job.** The extraction returns
 *    a title; if it shares no significant word with the stored one, the model
 *    locked onto another card and the result is DISCARDED rather than written.
 *
 * The third is what makes the other two safe to rely on, because neither is a
 * guarantee. `--verbose` prints each rejection.
 */

import { eq, sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { jobs as jobsTable, job_matches } from '$lib/server/db/schema';
import { parseJobDescription } from '$lib/server/jobs/parse-job-description';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 500;
const profileArg = process.argv.indexOf('--profile');
const ONLY_PROFILE = profileArg > -1 ? Number(process.argv[profileArg + 1]) : null;
const VERBOSE = process.argv.includes('--verbose');

/** Shortest stored description worth spending a call on. */
const MIN_TEXT = 200;

interface Candidate {
	id: number;
	title: string | null;
	company: string | null;
	location: string | null;
	text: string;
	/** True when `text` is captured HTML rather than this job's own description. */
	fromHtml: boolean;
	profile_id: number;
}

/** Words too common in job titles to prove two titles name the same posting. */
const TITLE_STOPWORDS = new Set([
	'senior',
	'junior',
	'lead',
	'principal',
	'staff',
	'head',
	'chief',
	'the',
	'and',
	'of',
	'for',
	'in',
	'at',
	'a',
	'an',
	'to',
	'with',
	'remote',
	'hybrid',
	'onsite',
	'full',
	'part',
	'time',
	'contract',
	'freelance',
	'manager',
	'specialist',
	'officer',
	'engineer',
	'developer',
	'analyst',
	'consultant',
	'associate',
	'assistant',
	'coordinator',
	'director',
	'intern',
	'expert',
	'advisor',
	'architect',
	'm',
	'f',
	'd',
	'x'
]);

function titleWords(title: string): Set<string> {
	return new Set(
		title
			.toLowerCase()
			.replace(/[^a-z0-9+#\s]/g, ' ')
			.split(/\s+/)
			.filter((w) => w.length > 1 && !TITLE_STOPWORDS.has(w))
	);
}

/**
 * Did the extraction answer about the job we asked about?
 *
 * Deliberately lenient: the extracted title is often a cleaned-up version of
 * the stored one, so ONE shared significant word is enough. It is not trying to
 * judge quality, only to catch the case the multi-card page produces, where the
 * two titles have nothing whatever in common. A stored title that is entirely
 * stopwords cannot answer the question, so it passes rather than blocking.
 */
function sameJob(stored: string | null, extracted: string | null | undefined): boolean {
	if (!stored || !extracted) return true;
	const a = titleWords(stored);
	const b = titleWords(extracted);
	if (a.size === 0 || b.size === 0) return true;
	for (const w of a) if (b.has(w)) return true;
	return false;
}

function isEmptySkills(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

async function main() {
	// The billing profile for the call, and the only per-job choice here: the
	// first profile that imported the job. Community jobs are shared, so any
	// importer is as correct as another, and a job nobody imported (seeded, or
	// its importer deleted) falls back to --profile. `runProfileAiChat` records
	// an ai_chats row against it; nothing charges credits off this path.
	const rows = await queryRawDirect<{
		id: number;
		title: string | null;
		company: string | null;
		location: string | null;
		description: string | null;
		html: string | null;
		profile_id: number | null;
	}>(sql`
		SELECT j.id, j.title, j.company, j.office_location AS location,
		       j.job_description AS description,
		       j.source_html_stripped AS html,
		       (SELECT ji.profile_id FROM job_importers ji
		         WHERE ji.job_id = j.id ORDER BY ji.date_created NULLS LAST, ji.id LIMIT 1) AS profile_id
		FROM jobs j
		WHERE (j.skills_required IS NULL OR j.skills_required::text = 'null'
		       OR jsonb_array_length(j.skills_required::jsonb) = 0)
		  AND (j.skills_preferred IS NULL OR j.skills_preferred::text = 'null'
		       OR jsonb_array_length(j.skills_preferred::jsonb) = 0)
		ORDER BY j.id
	`);

	const candidates: Candidate[] = [];
	let noText = 0;
	let noProfile = 0;

	for (const row of rows) {
		// The description first: it is this job's own text. The captured HTML is
		// richer but may be a whole results page — see the note above.
		const description = row.description?.trim() ?? '';
		const html = row.html?.trim() ?? '';
		const fromHtml = description.length < MIN_TEXT;
		const text = fromHtml ? html : description;
		if (text.length < MIN_TEXT) {
			noText++;
			continue;
		}
		const profile_id = row.profile_id ?? ONLY_PROFILE;
		if (!profile_id) {
			noProfile++;
			continue;
		}
		if (ONLY_PROFILE && row.profile_id !== ONLY_PROFILE) continue;
		candidates.push({
			id: row.id,
			title: row.title,
			company: row.company,
			location: row.location,
			text,
			fromHtml,
			profile_id
		});
	}

	console.log(
		`${rows.length} jobs have no skills at all.\n` +
			`  ${noText} have no stored text worth parsing (< ${MIN_TEXT} chars) — skipped\n` +
			`  ${noProfile} have no importer and no --profile fallback — skipped\n` +
			`  ${candidates.length} candidates` +
			(candidates.length > LIMIT ? `, capped at --limit ${LIMIT}` : '') +
			`\n`
	);

	const batch = candidates.slice(0, LIMIT);
	if (batch.length === 0) {
		console.log('✅ Nothing to do.');
		return;
	}
	if (!APPLY) console.log('Dry run — calls are made, nothing is written.\n');

	let filled = 0;
	let stillEmpty = 0;
	let failed = 0;
	let wrongJob = 0;

	for (const job of batch) {
		let parsed;
		try {
			// recoverHeader off: this is a skills backfill, and the header pass is
			// a second call for fields it does not write.
			//
			// The searchContext is the anchor. It matters only when `text` is a
			// captured page that may hold other cards, which is exactly when
			// `fromHtml` is set — and it is the same hint, for the same reason,
			// that the scraper passes after clicking a card.
			parsed = await parseJobDescription(job.text, {
				profileId: job.profile_id,
				recoverHeader: false,
				searchContext: job.fromHtml
					? {
							title: job.title ?? undefined,
							company: job.company ?? undefined,
							location: job.location ?? undefined
						}
					: undefined
			});
		} catch (err) {
			failed++;
			console.log(`  ✗ ${job.id} ${job.title ?? ''} — ${err}`);
			continue;
		}

		if (!parsed) {
			failed++;
			console.log(`  ✗ ${job.id} ${job.title ?? ''} — extraction returned nothing`);
			continue;
		}

		// A second empty result is a real answer, not a failure: some postings
		// genuinely name no skills. Counted separately so a run that changes
		// nothing is distinguishable from one that errored.
		if (isEmptySkills(parsed.skills_required) && isEmptySkills(parsed.skills_preferred)) {
			stillEmpty++;
			console.log(`  · ${job.id} ${job.title ?? ''} — still no skills`);
			continue;
		}

		// The answer must be about the job we asked about. On a captured results
		// page the model can lock onto a neighbouring card, and the skills it
		// returns then are plausible, wrong, and indistinguishable from correct
		// ones once written. Dropping the row costs one job's skills; writing it
		// costs the row's credibility.
		if (!sameJob(job.title, parsed.title)) {
			wrongJob++;
			if (VERBOSE) {
				console.log(
					`  ⚠ ${job.id} "${job.title ?? ''}" — extraction answered about ` +
						`"${parsed.title ?? ''}", discarded`
				);
			}
			continue;
		}

		filled++;
		const req = (parsed.skills_required ?? []) as string[];
		console.log(`  ✓ ${job.id} ${(job.title ?? '').slice(0, 50)} — ${req.join(', ')}`);

		if (!APPLY) continue;

		await db
			.update(jobsTable)
			.set({
				skills_required: parsed.skills_required,
				skills_preferred: parsed.skills_preferred,
				// Both were empty for the same reason and come from the same call.
				// Filled only when empty, for the same reason as the skills.
				responsibilities: parsed.responsibilities,
				soft_skills: parsed.soft_skills,
				date_updated: new Date()
			})
			.where(eq(jobsTable.id, job.id));

		// Skills are 35% of the score (`matcher.ts`), so every profile's number
		// for this job is now stale. Flag rather than delete, so the old score
		// stays visible until the background matcher replaces it. No inline
		// re-score: a sweep of hundreds should not hold the match queue.
		await db
			.update(job_matches)
			.set({ rescore_requested_at: new Date() })
			.where(eq(job_matches.job_id, job.id));
	}

	console.log(
		`\n${filled} filled, ${stillEmpty} genuinely have no skills, ` +
			`${wrongJob} answered about another job (discarded), ${failed} failed ` +
			`(of ${batch.length} attempted).`
	);
	if (wrongJob > 0 && !VERBOSE) {
		console.log('Re-run with --verbose to see which titles were discarded.');
	}
	if (!APPLY) {
		console.log('Dry run — re-run with --apply to write these changes.');
		return;
	}
	if (filled > 0) {
		console.log(
			`Matches for the ${filled} changed jobs are flagged for re-score; the ` +
				`background matcher picks them up on its next cycle.`
		);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
