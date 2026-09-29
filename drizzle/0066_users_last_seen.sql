-- Record when each account was last used, so background work can stop for the
-- ones nobody uses.
--
-- The matcher scored every new job for every enrolled profile, and the
-- scheduler ran every saved search, whether or not anyone still looked. On
-- preview (2026-09-29) four accounts idle for one to six months were still being
-- matched daily, which since matching charges credits spent their monthly
-- allowance on matches nobody saw, and one saved search had failed every day for
-- a month on a computer that was no longer connected. The idle rule in
-- $lib/server/account/spend-eligibility reads this column.
--
-- Seeded from what already shows use: the newest session and the newest MCP
-- call. An account with neither stays null and is measured from `createdAt`.
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp (6) with time zone;--> statement-breakpoint
UPDATE "users" AS u SET "last_seen_at" = seen.at
FROM (
	SELECT events.user_id, max(events.at) AS at
	FROM (
		SELECT "userId" AS user_id, "updatedAt" AS at FROM "sessions"
		UNION ALL
		SELECT "user_id", "last_used" FROM "mcp_keys"
	) AS events
	WHERE events.at IS NOT NULL
	GROUP BY events.user_id
) AS seen
WHERE seen.user_id = u."id";
