import { deleteSectionRow, patchSectionRow } from '#lib/server/profile/section-endpoint.ts';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = patchSectionRow;
export const DELETE: RequestHandler = deleteSectionRow;
