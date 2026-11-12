/**
 * The career-site feeds behind the feed platforms: the boards per provider,
 * their health, the sweep queue, and "sweep now". The corpus itself is the
 * worker's (planning/ATS-FEEDS.md); this page reads its tables and puts
 * requests on the `ats-board` queue.
 */
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { ats_boards, job_platforms } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/auth/guards';
import {
	enqueueAtsBoard,
	enqueueAtsSweep,
	getAtsBoardQueueStats,
	type AtsBoardQueueStats
} from '$lib/server/queue';
import { ATS_BOARD_STATUSES } from '$lib/job-platforms/ats-boards';

const BOARD_LIST_LIMIT = 50;
const RECENT_ERRORS_LIMIT = 20;

export type ProviderSummary = {
	provider: string;
	platform_name: string | null;
	platform_id: number | null;
	live: number;
	throttled: number;
	gone: number;
	closed: number;
	/** Live and throttled boards fetched in the last 24 hours: how far the night's sweep got. */
	fetched_24h: number;
	last_fetched_at: Date | null;
	open_postings: number;
	open_30d: number;
};

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const providerFilter = url.searchParams.get('provider')?.trim() ?? '';
	const statusFilter = url.searchParams.get('status')?.trim() ?? '';

	const boardConditions: SQL[] = [];
	if (q) {
		boardConditions.push(
			or(ilike(ats_boards.slug, `%${q}%`), ilike(ats_boards.company_name, `%${q}%`))!
		);
	}
	if (providerFilter) boardConditions.push(eq(ats_boards.provider, providerFilter));
	if (statusFilter && (ATS_BOARD_STATUSES as readonly string[]).includes(statusFilter)) {
		boardConditions.push(eq(ats_boards.status, statusFilter));
	}

	const [providerRows, postingRows, platforms, recentErrors, boards, queue] = await Promise.all([
		db
			.select({
				provider: ats_boards.provider,
				live: sql<number>`count(*) FILTER (WHERE ${ats_boards.status} = 'live')::int`,
				throttled: sql<number>`count(*) FILTER (WHERE ${ats_boards.status} = 'throttled')::int`,
				gone: sql<number>`count(*) FILTER (WHERE ${ats_boards.status} = 'gone')::int`,
				closed: sql<number>`count(*) FILTER (WHERE ${ats_boards.status} = 'closed')::int`,
				fetched_24h: sql<number>`count(*) FILTER (WHERE ${ats_boards.status} IN ('live', 'throttled') AND ${ats_boards.last_fetched_at} > now() - interval '24 hours')::int`,
				last_fetched_at: sql<Date | null>`max(${ats_boards.last_fetched_at})`
			})
			.from(ats_boards)
			.groupBy(ats_boards.provider)
			.orderBy(ats_boards.provider),
		// Open postings per provider. Counted on the postings table, not summed
		// from `posting_count`: a board's count is what its last fetch listed,
		// which the prune and the per-office merge both move away from.
		db.execute(
			sql`SELECT b.provider,
			           count(*) FILTER (WHERE p.closed_at IS NULL)::int AS open_postings,
			           count(*) FILTER (WHERE p.closed_at IS NULL AND p.published_at > now() - interval '30 days')::int AS open_30d
			    FROM ats_postings p JOIN ats_boards b ON b.id = p.board_id
			    GROUP BY b.provider`
		),
		db
			.select({ id: job_platforms.id, key: job_platforms.key, name: job_platforms.name })
			.from(job_platforms)
			.where(eq(job_platforms.fetch_mode, 'feed')),
		db
			.select({
				id: ats_boards.id,
				provider: ats_boards.provider,
				slug: ats_boards.slug,
				company_name: ats_boards.company_name,
				status: ats_boards.status,
				consecutive_failures: ats_boards.consecutive_failures,
				last_fetched_at: ats_boards.last_fetched_at,
				last_error: ats_boards.last_error
			})
			.from(ats_boards)
			.where(
				and(isNotNull(ats_boards.last_error), inArray(ats_boards.status, ['live', 'throttled']))
			)
			.orderBy(desc(ats_boards.last_fetched_at))
			.limit(RECENT_ERRORS_LIMIT),
		db
			.select({
				id: ats_boards.id,
				provider: ats_boards.provider,
				slug: ats_boards.slug,
				company_name: ats_boards.company_name,
				status: ats_boards.status,
				source: ats_boards.source,
				posting_count: ats_boards.posting_count,
				consecutive_failures: ats_boards.consecutive_failures,
				last_fetched_at: ats_boards.last_fetched_at,
				last_ok_at: ats_boards.last_ok_at,
				last_error: ats_boards.last_error
			})
			.from(ats_boards)
			.where(boardConditions.length ? and(...boardConditions) : undefined)
			.orderBy(desc(ats_boards.posting_count), ats_boards.slug)
			.limit(BOARD_LIST_LIMIT),
		// Redis down must not take the page with it; the table is the point.
		getAtsBoardQueueStats().catch((err): AtsBoardQueueStats | null => {
			console.warn('[admin/feeds] Could not read the ats-board queue:', err);
			return null;
		})
	]);

	const postingsByProvider = new Map(
		(postingRows.rows as { provider: string; open_postings: number; open_30d: number }[]).map(
			(r) => [r.provider, r]
		)
	);
	const platformByKey = new Map(platforms.map((p) => [p.key, p]));

	const providers: ProviderSummary[] = providerRows.map((r) => ({
		...r,
		platform_name: platformByKey.get(r.provider)?.name ?? null,
		platform_id: platformByKey.get(r.provider)?.id ?? null,
		open_postings: postingsByProvider.get(r.provider)?.open_postings ?? 0,
		open_30d: postingsByProvider.get(r.provider)?.open_30d ?? 0
	}));

	return {
		providers,
		recentErrors,
		boards,
		boardListLimit: BOARD_LIST_LIMIT,
		queue,
		filters: { q, provider: providerFilter, status: statusFilter }
	};
};

export const actions: Actions = {
	/** Ask the worker to sweep one provider, or every provider, now. */
	sweep: async (event) => {
		requireAdmin(event);
		const formData = await event.request.formData();
		const provider = String(formData.get('provider') ?? '').trim() || null;
		try {
			await enqueueAtsSweep(provider);
		} catch (err) {
			return fail(503, {
				error: `Could not queue the sweep: ${err instanceof Error ? err.message : String(err)}`
			});
		}
		return {
			message: provider
				? `Sweep of ${provider} requested. The worker checks the disk, prunes, and queues its boards.`
				: 'Sweep of every provider requested. The worker checks the disk, prunes, and queues the boards.'
		};
	},

	/** Sweep one board now. */
	sweepBoard: async (event) => {
		requireAdmin(event);
		const formData = await event.request.formData();
		const boardId = Number(formData.get('board_id'));
		if (!Number.isInteger(boardId) || boardId <= 0) return fail(400, { error: 'Invalid board id' });
		const board = await db.query.ats_boards.findFirst({
			where: eq(ats_boards.id, boardId),
			columns: { id: true, provider: true, slug: true }
		});
		if (!board) return fail(404, { error: `Board ${boardId} not found` });
		try {
			await enqueueAtsBoard(board, 'admin');
		} catch (err) {
			return fail(503, {
				error: `Could not queue the board: ${err instanceof Error ? err.message : String(err)}`
			});
		}
		return { message: `Queued ${board.provider}/${board.slug}.` };
	}
};
