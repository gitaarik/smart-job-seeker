/**
 * Parse a pasted job description into structured fields, without creating
 * anything.
 *
 * Backs the review step of the manual application-create flow: the user pastes
 * a posting, this endpoint extracts the fields, and the modal shows them for
 * correction before the job is written. The result is cached server-side under
 * a token so the subsequent create doesn't re-run (and re-charge) the LLM.
 *
 * Extraction failure is not an error here — a posting we can't parse should
 * still be enterable by hand — so a degraded parse returns 200 with
 * `ok: false` and the client falls through to blank fields.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { parseJobDescription } from '$lib/server/jobs/parse-job-description';
import { parseCacheKey, rememberParse } from '$lib/server/jobs/parse-cache';
import {
	normalizeExperienceLevels,
	normalizeJobType,
	normalizeWorkLocation
} from '$lib/data/job-normalize';
import { normalizeSalaryPeriod } from '$lib/salary/conversion';

/** Guards against pasting an entire site into the LLM prompt. */
const MAX_DESCRIPTION_CHARS = 100_000;

export const POST: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');

	const description = typeof body.description === 'string' ? body.description.trim() : '';
	if (!description) error(400, 'Description is required');
	if (description.length > MAX_DESCRIPTION_CHARS) {
		error(413, 'Description is too long to parse');
	}

	const sourceUrl =
		typeof body.source_url === 'string' && body.source_url.trim() ? body.source_url.trim() : null;

	let parsed = null;
	try {
		parsed = await parseJobDescription(description, { profileId, sourceUrl, recoverHeader: true });
	} catch (err) {
		console.warn(`[parse-description] extraction threw for profile ${profileId}:`, err);
	}

	if (!parsed) {
		return json({
			ok: false,
			message: "We couldn't read that posting automatically — you can fill in the details yourself."
		});
	}

	// The token is a hash of exactly the text we parsed, so the create action can
	// verify it against the description it receives before trusting the cache.
	const token = parseCacheKey(profileId, description);
	rememberParse(token, parsed);

	// Normalize here rather than in the client so the values shown in the review
	// form are the values that will actually be stored.
	const workLocation = normalizeWorkLocation(parsed.remote ?? null);
	const rawLocation = parsed.location ?? null;
	// A bare "Remote"/"Hybrid" in the location field is a work arrangement, not a
	// city — mirrors the split in createApplication and upsertJob.
	const officeLocation = rawLocation && normalizeWorkLocation(rawLocation) ? null : rawLocation;

	return json({
		ok: true,
		token,
		// Fields the review form exposes as editable inputs.
		fields: {
			title: parsed.title,
			company: parsed.company,
			job_poster: parsed.job_poster,
			office_location: officeLocation,
			work_location: workLocation ?? [],
			job_types: normalizeJobType(parsed.job_type ?? null) ?? [],
			experience_levels: normalizeExperienceLevels(parsed.experience_levels ?? null) ?? [],
			source_url: parsed.source_url,
			date_posted: parsed.date_posted ? parsed.date_posted.toISOString().split('T')[0] : null,
			salary_min: parsed.salary_min,
			salary_max: parsed.salary_max,
			salary_currency: parsed.salary_currency,
			salary_period: parsed.salary_period
				? normalizeSalaryPeriod(parsed.salary_period) || parsed.salary_period
				: null
		},
		// Not extracted, offered: a description of the work to use as the title
		// when the posting names no role. Kept out of `fields` so the form can
		// show it as a suggestion rather than as something the posting said.
		suggestions: {
			title: parsed.suggested_title
		},
		// Extracted detail the form doesn't make editable, shown read-only so the
		// user can see the parse worked. Editable later on the job page.
		preview: {
			company_description: parsed.company_description,
			skills_required: parsed.skills_required ?? [],
			skills_preferred: parsed.skills_preferred ?? [],
			responsibilities: parsed.responsibilities ?? [],
			soft_skills: parsed.soft_skills ?? []
		}
	});
};
