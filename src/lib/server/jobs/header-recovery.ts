/**
 * A second, narrower look at the four header fields of a pasted posting.
 *
 * The main extraction asks for twenty-odd fields at once, and on a paste with
 * no labelled header the four the applicant sees first — title, company,
 * recruiter, location — are the ones it most often leaves null even when the
 * posting names them. "Opdrachten toegekend door het bestuursteam van de
 * Belastingdienst" names a company; the main pass returned null for it with
 * that very sentence quoted as an example in its prompt. Asked for only those
 * four, with the line each was read from, the same model answers them.
 *
 * The quote is not decoration. It is what makes "if not sure, leave it blank"
 * mechanical rather than a matter of prompt wording: a value is kept only when
 * its quote is in the posting and the value is in the quote (see
 * `groundHeader`). A confident invention has no quote to point at, and a quote
 * the model tidied into something the posting does not say fails the same
 * check. Everything rejected becomes null, which the form shows as an empty
 * box to fill — never as a wrong value that looks finished.
 *
 * Run only when the first pass left a header field empty, and only for
 * pastes: a scraped page carries its header in markup, and the scraper pays
 * per job.
 */

import { runProfileAiChat } from '$lib/server/ai-chat/job-utils';
import {
	type ExtractedHeader,
	type GroundedHeaderResponse,
	groundHeader,
	suggestedTitle
} from './extracted-header';

/**
 * The header pass's answer: the four grounded fields, plus — when the posting
 * names no role — a description of the work to offer as a title. The
 * suggestion is kept apart from `title` so no caller can mistake a synthesis
 * for an extraction; the review form is the one place it is used, and it says
 * so next to the field.
 */
export interface RecoveredHeader extends ExtractedHeader {
	suggested_title: string | null;
}

const EMPTY: RecoveredHeader = {
	title: null,
	company: null,
	job_poster: null,
	location: null,
	suggested_title: null
};

/**
 * Run the header pass over an already-prepared posting. Best-effort like the
 * main pass: on any failure every field is null and the caller keeps what it
 * had.
 */
export async function recoverPostingHeader(
	posting: string,
	profileId: number
): Promise<RecoveredHeader> {
	const result = await runProfileAiChat<GroundedHeaderResponse>(profileId, 'extract_job_header', {
		posting
	});
	if (!result.success || !result.response) {
		console.warn(`[recoverPostingHeader] header pass returned no result: ${result.message}`);
		return { ...EMPTY };
	}
	return {
		...groundHeader(result.response, posting),
		suggested_title: suggestedTitle(result.response, posting)
	};
}
