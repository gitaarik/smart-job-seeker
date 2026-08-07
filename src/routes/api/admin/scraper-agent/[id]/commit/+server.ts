import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { scraper_agent_sessions } from '$lib/server/db/schema';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import { searchTaskDisplayName } from '$lib/format';
import { execFileSync } from 'child_process';

const CLOUD_DIR = '/cloud';

function git(...args: string[]): string {
	return execFileSync('git', ['-c', `safe.directory=${CLOUD_DIR}`, ...args], {
		cwd: CLOUD_DIR,
		encoding: 'utf-8',
		timeout: 30_000
	}).trim();
}

export const POST: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	if (!(user as { is_admin?: boolean }).is_admin) {
		throw error(403, 'Admin access required');
	}

	const sessionId = parseIntParam(params.id, 'session');

	const session = await db.query.scraper_agent_sessions.findFirst({
		where: eq(scraper_agent_sessions.id, sessionId),
		with: {
			search_task: {
				columns: { note: true },
				with: { job_platform: { columns: { name: true } } }
			}
		}
	});

	if (!session) throw error(404, 'Session not found');
	if (session.status !== 'completed') {
		throw error(400, `Can only commit completed sessions (current: "${session.status}")`);
	}

	try {
		// Check if there are changes to commit in the scrapers directory
		const status = git('status', '--porcelain', 'src/server/scrapers/');
		if (!status) {
			return json({ committed: false, message: 'No changes to commit in scrapers directory' });
		}

		// Stage scraper changes
		git('add', 'src/server/scrapers/');

		// Build commit message
		const taskName = searchTaskDisplayName(
			session.search_task.job_platform?.name,
			session.search_task.note
		);
		const message = [
			`Scraper agent: improve scraper for "${taskName}"`,
			'',
			`Session ${session.id} completed after ${session.current_iteration} iterations.`,
			`Goal: ${session.goal}`
		].join('\n');

		// Commit
		git('commit', '-m', message);

		// Push
		git('push');

		return json({ committed: true, message: 'Changes committed and pushed' });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw error(500, `Git operation failed: ${msg}`);
	}
};
