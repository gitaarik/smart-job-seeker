/**
 * Everything one platform asks for, as a zip: the newest crop for each of its
 * presets, across the selected profile's library.
 *
 * A preset nothing has been cropped for yet is named in the zip's README, so
 * an empty slot is something the person sees rather than a file they never
 * notice is missing.
 */

import { error } from '@sveltejs/kit';
import JSZip from 'jszip';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { dbDirect as db } from '$lib/server/db';
import { media_items, media_presets, media_renditions } from '$lib/server/db/schema';
import { renditionBytes } from '$lib/server/media/serve';
import { renditionFilename } from '$lib/server/media/renditions';
import { contentDisposition } from '$lib/server/files';
import { presetName } from '$lib/media-library';

export const GET: RequestHandler = async ({ params, cookies, locals }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');
	const platform = params.platform.trim();
	if (!platform) error(400, 'Which platform?');

	const presets = await db.query.media_presets.findMany({
		where: and(
			eq(media_presets.platform, platform),
			or(isNull(media_presets.profile_id), eq(media_presets.profile_id, profileId))
		)
	});
	if (presets.length === 0) error(404, 'No presets for that platform');

	const items = await db.query.media_items.findMany({
		where: eq(media_items.profile_id, profileId),
		columns: { id: true, label: true }
	});
	const labels = new Map(items.map((item) => [item.id, item.label]));
	const renditions = items.length
		? await db.query.media_renditions.findMany({
				where: and(
					inArray(
						media_renditions.preset_id,
						presets.map((p) => p.id)
					),
					inArray(
						media_renditions.item_id,
						items.map((i) => i.id)
					)
				),
				orderBy: desc(media_renditions.date_created)
			})
		: [];

	const zip = new JSZip();
	const missing: string[] = [];
	for (const preset of presets) {
		const newest = renditions.find((r) => r.preset_id === preset.id);
		if (!newest) {
			missing.push(`${presetName(preset)} (${preset.width}x${preset.height})`);
			continue;
		}
		const served = await renditionBytes(newest.id);
		if (!served) {
			missing.push(`${presetName(preset)} (could not be drawn)`);
			continue;
		}
		zip.file(
			renditionFilename(
				labels.get(newest.item_id),
				preset,
				newest.width,
				newest.height,
				served.rendition.format
			),
			served.bytes
		);
	}
	const lines = [
		`${platform}: the newest crop for each image it asks for, from Smart Job Seeker.`,
		...(missing.length ? ['', 'Not cropped yet:', ...missing.map((m) => `- ${m}`)] : [])
	];
	zip.file('README.txt', lines.join('\n') + '\n');

	const buffer = await zip.generateAsync({ type: 'nodebuffer' });
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': contentDisposition(
				`${platform.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-images.zip`
			),
			'Cache-Control': 'private, no-store'
		}
	});
};
