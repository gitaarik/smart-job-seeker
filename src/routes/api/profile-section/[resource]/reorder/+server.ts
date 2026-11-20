import { reorderSectionRows } from '#lib/server/profile/section-endpoint.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = reorderSectionRows;
