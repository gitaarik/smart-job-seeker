import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { listContacts } from '$lib/server/contacts';
import { listDevicesSharedByMe } from '$lib/server/device-shares';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.user) {
		redirect(302, '/login');
	}

	const [contacts, sharedDevices] = await Promise.all([
		listContacts(layoutData.user.id),
		listDevicesSharedByMe(layoutData.user.id)
	]);

	return { contacts, sharedDevices };
};
