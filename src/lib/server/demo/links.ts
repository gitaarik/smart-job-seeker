/**
 * Demo invite link management (admin side).
 *
 * Create / list / revoke shareable demo links and the device grants attached to
 * them. Provisioning of the actual demo user happens lazily on first open — see
 * provision.ts. Cleanup of expired links lives in cleanup.ts.
 */

import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import {
  api_keys,
  type DemoLinks,
  demo_link_devices,
  demo_links,
} from "$lib/server/db/schema";

/** Generated as a url-safe random token (~32 chars). */
function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface CreateDemoLinkParams {
  createdBy: string;
  /** api_key ids (devices owned by the creator) the link grants access to. */
  deviceApiKeyIds: number[];
  ttlSeconds: number;
  /** Per-link scrape-run ceiling; null = no extra cap beyond plan/device. */
  maxRuns: number | null;
}

/** Create a demo link and its device grants. Returns the inserted row. */
export async function createDemoLink(
  params: CreateDemoLinkParams,
): Promise<DemoLinks> {
  const { createdBy, deviceApiKeyIds, ttlSeconds, maxRuns } = params;

  // Guard: only the creator's own, non-revoked devices may be attached.
  if (deviceApiKeyIds.length > 0) {
    const owned = await db.query.api_keys.findMany({
      where: and(
        eq(api_keys.user_id, createdBy),
        eq(api_keys.revoked, false),
        inArray(api_keys.id, deviceApiKeyIds),
      ),
      columns: { id: true },
    });
    if (owned.length !== deviceApiKeyIds.length) {
      throw new Error("One or more selected devices are not yours.");
    }
  }

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const [link] = await db.insert(demo_links).values({
    token: generateToken(),
    created_by: createdBy,
    ttl_seconds: ttlSeconds,
    expires_at: expiresAt,
    max_runs: maxRuns,
  }).returning();

  if (deviceApiKeyIds.length > 0) {
    await db.insert(demo_link_devices).values(
      deviceApiKeyIds.map((api_key_id) => ({
        demo_link_id: link.id,
        api_key_id,
      })),
    );
  }

  return link;
}

/** Revoke a link (the creator's only). Does not delete the demo user yet — the
 * cleanup job reaps it once revoked/expired. */
export async function revokeDemoLink(
  linkId: number,
  createdBy: string,
): Promise<void> {
  await db.update(demo_links)
    .set({ status: "revoked" })
    .where(and(eq(demo_links.id, linkId), eq(demo_links.created_by, createdBy)));
}

export interface DemoLinkListItem extends DemoLinks {
  deviceNames: string[];
}

/** List a creator's demo links, newest first, with their granted device names. */
export async function listDemoLinks(
  createdBy: string,
): Promise<DemoLinkListItem[]> {
  const links = await db.query.demo_links.findMany({
    where: eq(demo_links.created_by, createdBy),
    orderBy: desc(demo_links.date_created),
  });
  if (links.length === 0) return [];

  // Resolve device names for the attached api_keys in one pass.
  const grants = await db.query.demo_link_devices.findMany({
    where: inArray(demo_link_devices.demo_link_id, links.map((l) => l.id)),
  });
  const keyIds = Array.from(new Set(grants.map((g) => g.api_key_id)));
  const keys = keyIds.length
    ? await db.query.api_keys.findMany({
      where: inArray(api_keys.id, keyIds),
      columns: { id: true, name: true },
    })
    : [];
  const nameById = new Map(keys.map((k) => [k.id, k.name ?? `Device ${k.id}`]));

  return links.map((link) => ({
    ...link,
    deviceNames: grants
      .filter((g) => g.demo_link_id === link.id)
      .map((g) => nameById.get(g.api_key_id) ?? `Device ${g.api_key_id}`),
  }));
}
