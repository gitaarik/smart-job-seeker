/**
 * Admin-only platform discovery API.
 *
 * GET  /api/admin/search-form-probe           — list recent runs
 * POST /api/admin/search-form-probe           — create + enqueue a new run on an
 *                                       existing job_platforms row, using
 *                                       the credentials + (optional) device
 *                                       configured on the per-platform
 *                                       discovery page
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { desc, eq } from 'drizzle-orm';
import { job_platforms, platform_credentials, search_form_probe_runs } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { addSearchFormProbeJob } from '$lib/server/queue/search-form-probe-queue';
import { hasCredentialAccess } from '$lib/server/credential-shares';
import { hasDeviceAccess } from '$lib/server/device-shares';

function requireAdmin(locals: App.Locals) {
	const user = requireAuth(locals);
	if (!(user as { is_admin?: boolean }).is_admin) {
		throw error(403, 'Admin access required');
	}
	return user;
}

export const GET: RequestHandler = async ({ locals }) => {
	requireAdmin(locals);
	const runs = await db
		.select()
		.from(search_form_probe_runs)
		.orderBy(desc(search_form_probe_runs.started_at))
		.limit(50);
	return json({ runs });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireAdmin(locals);
	const body = (await request.json()) as {
		platform_id?: number;
		platform_credential_id?: number | null;
		sjsbrowser_api_key_id?: number | null;
	};
	const platformId = Number(body.platform_id);
	if (!Number.isInteger(platformId) || platformId <= 0) {
		throw error(400, 'platform_id is required');
	}

	const platform = await db.query.job_platforms.findFirst({
		where: eq(job_platforms.id, platformId),
		columns: { id: true, url: true, name: true, login_page_url: true }
	});
	if (!platform) throw error(404, 'Platform not found');
	if (!platform.url) throw error(400, 'Platform has no base URL');
	if (!platform.login_page_url) {
		throw error(400, 'Platform has no login_page_url — set one before running discovery');
	}
	let parsed: URL;
	try {
		parsed = new URL(platform.url);
	} catch {
		throw error(400, 'Platform URL is not a valid URL');
	}
	if (!['http:', 'https:'].includes(parsed.protocol)) {
		throw error(400, 'Platform URL must be http(s)');
	}

	const credentialId = body.platform_credential_id ?? null;
	if (credentialId === null) {
		throw error(400, 'platform_credential_id is required — discovery needs a login');
	}
	if (!Number.isInteger(credentialId) || credentialId <= 0) {
		throw error(400, 'Invalid platform_credential_id');
	}
	const cred = await db.query.platform_credentials.findFirst({
		where: eq(platform_credentials.id, credentialId),
		columns: { id: true, platform_id: true }
	});
	if (!cred) throw error(404, 'Credential not found');
	if (cred.platform_id !== platform.id) {
		throw error(400, 'Credential is for a different platform');
	}
	const canAccessCred = await hasCredentialAccess(cred.id, user.id);
	if (!canAccessCred) {
		throw error(403, "You don't have access to this credential");
	}

	const deviceId = body.sjsbrowser_api_key_id ?? null;
	if (deviceId !== null) {
		if (!Number.isInteger(deviceId) || deviceId <= 0) {
			throw error(400, 'Invalid sjsbrowser_api_key_id');
		}
		const canAccessDev = await hasDeviceAccess(deviceId, user.id);
		if (!canAccessDev) {
			throw error(403, "You don't have access to this device");
		}
	}

	const [run] = await db
		.insert(search_form_probe_runs)
		.values({
			platform_id: platform.id,
			target_url: parsed.toString(),
			status: 'queued',
			triggered_by_user_id: user.id,
			platform_credential_id: credentialId,
			sjsbrowser_api_key_id: deviceId
		})
		.returning();

	const job = await addSearchFormProbeJob({
		discoveryRunId: run.id,
		targetUrl: parsed.toString(),
		triggeredByUserId: user.id
	});

	await db
		.update(search_form_probe_runs)
		.set({ bullmq_job_id: job.id ?? null })
		.where(eq(search_form_probe_runs.id, run.id));

	return json({ run });
};
