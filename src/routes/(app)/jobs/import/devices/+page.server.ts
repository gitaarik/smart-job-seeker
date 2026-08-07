import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listApiKeys } from '$lib/server/auth/api-key';
import { listSharedWithMe } from '$lib/server/device-shares';

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}
	if (!layoutData.user) {
		redirect(302, '/login');
	}

	// Persist the setup-instructions collapse state in a cookie so SSR renders
	// the right state on refresh (no expand→collapse flash). Defaults to open.
	const setupExpanded = cookies.get('devices_setup_expanded') !== 'false';

	// listSharedWithMe no longer carries the device key at all — a contact uses
	// the device through the import flow rather than configuring a tunnel client
	// — so there is nothing left to strip here.
	const apiKeys = await listApiKeys(layoutData.user.id);
	const sharedDevices = await listSharedWithMe(layoutData.user.id);

	return {
		apiKeys,
		sharedDevices,
		setupExpanded
	};
};
