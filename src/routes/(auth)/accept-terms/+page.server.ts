import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { termsVersion } from '$lib/server/legal/texts';
import { acceptedTermsField, recordTermsAcceptance } from '$lib/server/legal/record';
import { mustAcceptTerms, safeReturnPath } from '$lib/server/legal/gate';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) redirect(302, '/login');

	const returnTo = safeReturnPath(url.searchParams.get('redirect'));
	// Nothing to accept: the guard that sends people here would not have.
	if (!mustAcceptTerms(user, !!locals.adminUser)) redirect(302, returnTo);

	return {
		termsVersion: termsVersion()!,
		// An account that accepted an older version is told the terms changed;
		// one that never accepted any is only asked.
		updated: !!(user as { terms_version?: string | null }).terms_version
	};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const user = locals.user;
		if (!user) redirect(302, '/login');

		const formData = await request.formData();
		if (!acceptedTermsField(formData)) {
			return fail(400, { error: 'Please accept the terms of service and privacy policy.' });
		}
		await recordTermsAcceptance(user.id);
		redirect(302, safeReturnPath(url.searchParams.get('redirect')));
	}
};
