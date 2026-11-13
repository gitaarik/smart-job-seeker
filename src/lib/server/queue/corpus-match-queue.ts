/**
 * Corpus match queue
 *
 * One BullMQ job per profile per night: pick up to the profile's daily cap of
 * career-site postings (`ats_postings`) and import them for the matcher as
 * `job_importers.source = 'corpus'`. The worker in cloud fills the queue once
 * the nightly ATS sweep has finished and processes it one profile at a time.
 * See sjs-ops planning/CORPUS-MATCHING.md.
 *
 * The job carries the night's skill rarity counts for the profile's phrases:
 * they are counted once a night over one sample of the corpus for every
 * profile together, not once per profile.
 */

import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export interface CorpusMatchJobData {
	profileId: number;
	/** The UTC date of the night, `2026-11-13`; part of the job id. */
	night: string;
	/** Postings in the night's rarity sample that name each of this profile's phrases. */
	df: Record<string, number>;
	/** Postings in the sample. */
	total: number;
}

export interface CorpusMatchJobResult {
	/** Picks linked to the profile. */
	linked: number;
	/** One line for the worker log. */
	detail: string;
}

export const CORPUS_MATCH_QUEUE = 'corpus-match';

/** How long a finished job keeps its id: past the next night, so a restart does not run a night twice. */
const KEEP_SECONDS = 36 * 60 * 60;

const defaultJobOptions = {
	removeOnComplete: { age: KEEP_SECONDS },
	removeOnFail: { age: KEEP_SECONDS },
	attempts: 1
};

let _q: Queue<CorpusMatchJobData, CorpusMatchJobResult> | null = null;

export function getCorpusMatchQueue() {
	return (_q ??= new Queue(CORPUS_MATCH_QUEUE, {
		connection: redisConnection,
		defaultJobOptions
	}));
}

/** The job id for a profile's night: one run per profile per night, however often it is asked for. */
export function corpusMatchJobId(profileId: number, night: string) {
	return `corpus-${profileId}-${night}`;
}

/** Whether a profile's night is queued, running or done (within `KEEP_SECONDS`). */
export async function corpusNightQueued(profileId: number, night: string): Promise<boolean> {
	return (await getCorpusMatchQueue().getJob(corpusMatchJobId(profileId, night))) != null;
}

export async function enqueueCorpusMatches(jobs: CorpusMatchJobData[]) {
	if (!jobs.length) return 0;
	await getCorpusMatchQueue().addBulk(
		jobs.map((data) => ({
			name: 'profile',
			data,
			opts: { jobId: corpusMatchJobId(data.profileId, data.night) }
		}))
	);
	return jobs.length;
}
