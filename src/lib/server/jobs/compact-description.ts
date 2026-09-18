/**
 * A shortened job description, for the prompts that have to fit one.
 *
 * ## Why this exists
 *
 * `assembleGenerationContext` gives every writing prompt a char budget and packs
 * the evidence into it. The job posting is the one block whose size nobody
 * chose: it is as long as the employer made it. Measured on application 73, a
 * 21,663-char description took a 24,000-char budget whole and the applicant's
 * projects, stories and past writing were all dropped after every one of them
 * had found real matches. `fitToBudget`'s ranked floor now guarantees retrieval
 * a seat; this attacks the other half, by making the posting itself smaller.
 *
 * ## Why on demand, and only for the long ones
 *
 * The obvious version of this — summarise every posting at import — is a bad
 * trade, and the numbers say so. Measured on dev: 3,573 postings, median 2,293
 * chars, and only 96 of them (2.7%) over the threshold below. Summarising at
 * import would pay an LLM call for all 3,573, most of them already compact, most
 * of them for jobs nobody will ever write about. Doing it here, lazily, when a
 * prompt actually needs a long posting, pays for the handful that are both long
 * AND used.
 *
 * It is also NOT a token-saving measure for match scoring, which is where the
 * money actually is. Measured over 30 days, a `score_job_match` call averages
 * 15.7-17.8k input tokens and a median description is ~570 of them: 3-4%. The
 * matcher deliberately keeps reading `job_description` in full, because
 * rewriting what scoring sees would make every new score incomparable with every
 * old one in exchange for ~3%.
 *
 * ## What it is not
 *
 * Not a replacement for `job_description`, which stays the record of what was
 * posted, and not a clip. Clipping a posting cuts the requirements off the
 * bottom; this drops boilerplate and keeps the employer's own wording, because
 * the prompts downstream quote that wording back at them.
 */

import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { jobs } from '$lib/server/db/schema';
import { createAndGenerateAiChat } from '$lib/server/ai-chat/utils';

/**
 * Descriptions at or under this are used as they are.
 *
 * 6,000 sits well above the median (2,293) and above the ~4,000 the extraction
 * prompt already asks for, so this only fires on postings that escaped that
 * instruction or never went through it — a pasted posting keeps its lines by
 * design (see jobs/posting-text.ts), which is how the 21,663-char one got in.
 */
export const COMPACT_THRESHOLD_CHARS = 6000;

/**
 * Floors below which a result is treated as a failure rather than a very good
 * summary. A model that answers with a refusal, a preamble or a single line has
 * produced something that would silently delete the posting from every letter
 * written for this job, and the full text is a better answer than that.
 *
 * The absolute floor does the real work: a refusal is 50-200 chars and a genuine
 * compaction is thousands. The ratio is deliberately generous, because the
 * prompt targets ~3,000 chars regardless of input size, so a strict ratio would
 * reject exactly the longest postings — the ones this exists for. At 5% it only
 * bites above 60,000 chars, where a 3,000-char answer really would be suspect.
 */
const MIN_RATIO = 0.05;
const MIN_CHARS = 800;

/** The columns this needs; spread into a caller's own column selection. */
export const COMPACT_COLUMNS = {
	id: true,
	job_description: true,
	description_compact: true,
	description_compact_hash: true,
	description_compact_status: true
} as const;

export interface CompactableJob {
	id: number;
	job_description: string | null;
	description_compact: string | null;
	description_compact_hash: string | null;
	description_compact_status: string | null;
}

export interface PromptDescription {
	/** The text a prompt should render. Null when the job has no description. */
	text: string | null;
	/**
	 * Whether `text` is the shortened version. Callers say so in the block they
	 * render: a model asked "what does the posting say about X" is entitled to
	 * know it is not holding the whole posting.
	 */
	compacted: boolean;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Record an outcome without letting a failed write fail a generation. */
async function remember(jobId: number, values: Partial<typeof jobs.$inferInsert>): Promise<void> {
	try {
		await db.update(jobs).set(values).where(eq(jobs.id, jobId));
	} catch (err) {
		console.warn(`[compact-description] could not store job ${jobId}:`, err);
	}
}

/**
 * The description a prompt should use for this job, shortening it first if it is
 * long enough to be worth it.
 *
 * Cached on the job row and keyed by a hash of the description it was made from,
 * so an edited posting regenerates rather than serving a summary of text that no
 * longer exists. A failure is remembered too: a posting the model chokes on must
 * not retry its call on every generation.
 *
 * Never throws. The full description is always a correct answer, so every
 * failure path returns it.
 */
export async function promptJobDescription(
	job: CompactableJob,
	profileId: number
): Promise<PromptDescription> {
	const full = job.job_description;
	if (!full?.trim()) return { text: full, compacted: false };

	if (full.length <= COMPACT_THRESHOLD_CHARS) {
		// Written once, never again: "short enough not to bother" and "we have
		// never looked at this" are different facts, and only one of them is worth
		// checking when a posting shows up in a prompt at full length.
		if (job.description_compact_status === null) {
			await remember(job.id, { description_compact_status: 'skipped' });
		}
		return { text: full, compacted: false };
	}

	const hash = sha256(full);
	const fresh = job.description_compact_hash === hash;
	if (fresh && job.description_compact_status === 'done' && job.description_compact?.trim()) {
		return { text: job.description_compact, compacted: true };
	}
	// A posting that already failed against this exact text gets one attempt, not
	// one per generation.
	if (fresh && job.description_compact_status === 'failed') {
		return { text: full, compacted: false };
	}

	let compact: string | null = null;
	try {
		const result = await createAndGenerateAiChat(
			profileId,
			'compact_job_description',
			{ jobDescription: full },
			undefined,
			// The profile blob is 34-48k chars and this prompt never mentions it.
			// An empty field list is honoured explicitly by loadProfileData.
			{ profileDataFields: [] }
		);
		compact = result.success ? (result.aiChat?.response?.trim() ?? null) : null;
	} catch (err) {
		console.warn(`[compact-description] job ${job.id} failed:`, err);
	}

	// Caller-side coercion, because a schema cannot express "actually shorter and
	// actually the posting". A result that grew, or that collapsed to a line, is
	// a failure however well-formed it is.
	const usable =
		!!compact &&
		compact.length < full.length &&
		compact.length >= Math.max(MIN_CHARS, full.length * MIN_RATIO);

	if (!usable) {
		await remember(job.id, {
			description_compact: null,
			description_compact_hash: hash,
			description_compact_status: 'failed'
		});
		return { text: full, compacted: false };
	}

	await remember(job.id, {
		description_compact: compact,
		description_compact_hash: hash,
		description_compact_status: 'done'
	});
	return { text: compact, compacted: true };
}
