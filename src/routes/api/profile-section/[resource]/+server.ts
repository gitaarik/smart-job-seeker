import { createSectionRow } from '$lib/server/profile/section-endpoint';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = createSectionRow;
