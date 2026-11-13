import type { PageServerLoad } from './$types';
import { autoApproveSignups } from '$lib/server/auth/registration';

/**
 * Whether to tell the visitor to wait for approval.
 *
 * Someone arriving straight from the signup form is not signed in yet (the
 * address is unverified), and where signups approve themselves the only step
 * left is the link. Someone signed in who lands here was sent by the approval
 * gate, so for them the wait is real whatever the setting says.
 */
export const load: PageServerLoad = async ({ locals }) => {
	return { awaitsApproval: !!locals.user || !autoApproveSignups() };
};
