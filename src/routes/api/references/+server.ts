import type { RequestHandler } from './$types';
import { profileReorderHandler } from '$lib/server/profile/reorder-endpoint';

export const PATCH: RequestHandler = profileReorderHandler('reference');
