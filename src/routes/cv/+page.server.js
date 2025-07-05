import { loadProfile } from '$lib/server/profile-loader';

export async function load() {
	return await loadProfile();
}
