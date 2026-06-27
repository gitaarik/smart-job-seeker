/**
 * Expire and deactivate demo links past their TTL (or revoked).
 *
 * Safety-first: this cuts off the demo user's access — drops their sessions
 * (forces logout), removes their device shares (stops scraping on the host's
 * devices), and de-approves the account (blocks the API) — then flips the link
 * to `expired`. Hard-deleting the demo user + cloned data is a deliberate
 * follow-up (no tested cascade for profiles yet); deactivation is what matters
 * for protecting the host's devices and credits.
 *
 * Run periodically from the worker. Idempotent.
 */

import { and, eq, inArray, lte, ne, or } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import {
  credential_shares,
  demo_links,
  device_shares,
  sessions,
  users,
} from "$lib/server/db/schema";

export interface DemoCleanupResult {
  linksExpired: number;
  usersDeactivated: number;
}

export async function cleanupExpiredDemoLinks(): Promise<DemoCleanupResult> {
  // Links that should no longer grant access: still 'active' but past TTL, or
  // 'revoked' (the admin pulled it) and not yet reaped.
  const stale = await db.query.demo_links.findMany({
    where: or(
      and(
        eq(demo_links.status, "active"),
        lte(demo_links.expires_at, new Date()),
      ),
      eq(demo_links.status, "revoked"),
    ),
  });
  if (stale.length === 0) return { linksExpired: 0, usersDeactivated: 0 };

  const demoUserIds = stale
    .map((l) => l.demo_user_id)
    .filter((id): id is string => id !== null);

  let usersDeactivated = 0;
  if (demoUserIds.length > 0) {
    // Force logout + stop scraping + block API for the minted demo users.
    await db.delete(sessions).where(inArray(sessions.userId, demoUserIds));
    await db.delete(device_shares)
      .where(inArray(device_shares.shared_with, demoUserIds));
    await db.delete(credential_shares)
      .where(inArray(credential_shares.shared_with, demoUserIds));
    const res = await db.update(users)
      .set({ is_approved: false })
      // Guard with is_demo so we never touch a real account by accident.
      .where(and(inArray(users.id, demoUserIds), eq(users.is_demo, true)));
    usersDeactivated = res.rowCount ?? 0;
  }

  // Mark revoked links that were already expired-by-time as 'expired' too, and
  // flip the time-expired actives. (ne avoids rewriting already-expired rows.)
  const res = await db.update(demo_links)
    .set({ status: "expired" })
    .where(and(
      inArray(demo_links.id, stale.map((l) => l.id)),
      ne(demo_links.status, "expired"),
    ));

  return { linksExpired: res.rowCount ?? 0, usersDeactivated };
}
