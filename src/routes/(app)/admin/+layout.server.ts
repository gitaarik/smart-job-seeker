import type { LayoutServerLoad } from './$types';
import { requireAdmin } from '#lib/server/auth/guards.ts';

export const load: LayoutServerLoad = async (event) => {
	requireAdmin(event);
};
