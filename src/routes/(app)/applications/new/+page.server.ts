import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getSelectedProfileId } from '../../profile/utils';
import type { ParsedJobDescription } from '$lib/server/jobs/parse-job-description';
import { parseCacheKey, recallParse } from '$lib/server/jobs/parse-cache';
import { parseIntOrNull, strArrayOrNull, strOrNull } from '$lib/server/jobs/job-fields';
import { createApplication, parseForNewApplication } from '$lib/server/applications/create';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();
	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const title = strOrNull(formData.get('title'));
		const company = strOrNull(formData.get('company'));
		const jobPoster = strOrNull(formData.get('job_poster'));
		const officeLocation = strOrNull(formData.get('office_location'));
		const workLocationForm = strArrayOrNull(formData.getAll('work_location'));
		const jobTypesForm = strArrayOrNull(formData.getAll('job_types'));
		const experienceLevelsForm = strArrayOrNull(formData.getAll('experience_levels'));
		const datePostedForm = strOrNull(formData.get('date_posted'));
		const sourceUrl = strOrNull(formData.get('source_url'));
		const jobDescription = strOrNull(formData.get('job_description'));
		const salaryMin = parseIntOrNull(formData.get('salary_min'));
		const salaryMax = parseIntOrNull(formData.get('salary_max'));
		const salaryCurrency = strOrNull(formData.get('salary_currency'));
		const salaryPeriod = strOrNull(formData.get('salary_period'));
		const parseToken = strOrNull(formData.get('parse_token'));
		const parseFailed = formData.get('parse_failed') === '1';

		// Any filled job field turns this into a manual job + linked application;
		// an empty form keeps the original one-click blank-application behavior.
		const hasJobDetails = !!(
			title ||
			company ||
			jobPoster ||
			officeLocation ||
			sourceUrl ||
			jobDescription ||
			salaryMin ||
			salaryMax ||
			workLocationForm ||
			jobTypesForm ||
			experienceLevelsForm ||
			datePostedForm
		);

		// Enrich a pasted description the same way the scraper does: extract
		// skills, responsibilities, work location, etc.
		//
		// The page parses up front (POST /api/jobs/parse-description) so the
		// user can review the extracted fields, and hands back the token it got.
		// The token is a hash of the parsed text, so it only resolves while the
		// description is unchanged — editing it in the review step invalidates
		// the token and we re-parse here. We also re-parse when the cache entry
		// has aged out, which recovers the structured fields the form doesn't
		// expose (skills, responsibilities, company description).
		//
		// Best-effort throughout: on any failure (LLM error, no credits) `parsed`
		// is null and we store only what the user typed, so creation is never
		// blocked.
		let parsed: ParsedJobDescription | null = null;
		let tokenMatches = false;
		if (hasJobDetails && jobDescription) {
			tokenMatches = parseToken === parseCacheKey(profileId, jobDescription);
			if (tokenMatches && parseToken) parsed = recallParse(parseToken);
			// `parse_failed` means extraction already ran on this paste and came
			// back empty — don't burn a second call to fail the same way.
			if (!parsed && !parseFailed) {
				parsed = await parseForNewApplication(jobDescription, { profileId, sourceUrl });
			}
		}

		const { applicationId } = await createApplication({
			profileId,
			job: hasJobDetails
				? {
						title,
						company,
						job_poster: jobPoster,
						office_location: officeLocation,
						source_url: sourceUrl,
						job_description: jobDescription,
						salary_min: salaryMin,
						salary_max: salaryMax,
						salary_currency: salaryCurrency,
						salary_period: salaryPeriod,
						work_location: workLocationForm,
						job_types: jobTypesForm,
						experience_levels: experienceLevelsForm,
						date_posted: datePostedForm
					}
				: null,
			parsed,
			// Did the form the user submitted actually show them this parse? Only
			// then are its inputs authoritative — otherwise clearing a pre-filled
			// field would silently resurrect the parsed value.
			reviewed: tokenMatches
		});

		redirect(302, `/applications/${applicationId}`);
	}
};
