import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import {
	job_platforms,
	search_form_probe_logs,
	search_form_probe_runs,
	search_form_probe_debug
} from '$lib/server/db/schema';
import { loadSearchFormProbeFormData } from '$lib/server/job-platforms/search-form-probe-form-data';

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = parseInt(params.id, 10);
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid run id');

	const user = locals.user;
	if (!user) throw error(401, 'Not authenticated');

	const run = await db.query.search_form_probe_runs.findFirst({
		where: eq(search_form_probe_runs.id, id)
	});
	if (!run) throw error(404, 'Run not found');

	const platform = run.platform_id
		? await db.query.job_platforms.findFirst({
				where: eq(job_platforms.id, run.platform_id),
				columns: {
					id: true,
					name: true,
					url: true,
					login_page_url: true
				}
			})
		: null;

	const logs = await db
		.select()
		.from(search_form_probe_logs)
		.where(eq(search_form_probe_logs.discovery_run_id, id))
		.orderBy(asc(search_form_probe_logs.id))
		.limit(500);

	// Fetch HTML debug data for this discovery run
	const debugData = await db
		.select()
		.from(search_form_probe_debug)
		.where(eq(search_form_probe_debug.discovery_run_id, id))
		.orderBy(asc(search_form_probe_debug.captured_at));

	// Credentials/devices are only used to render friendly labels for the
	// credential + device the run used — credential management itself lives
	// on the per-platform discovery page. profileId is forwarded so the
	// browser-view modal can poll tunnel screenshots when the run was routed
	// through a desktop device.
	const formData = run.platform_id
		? await loadSearchFormProbeFormData(run.platform_id, user.id)
		: { credentials: [], devices: [], profileId: null };

	return {
		run,
		platform,
		logs,
		debugData,
		credentials: formData.credentials,
		devices: formData.devices,
		profileId: formData.profileId
	};
};
