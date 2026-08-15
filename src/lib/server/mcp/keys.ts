/**
 * Credentials for the MCP server.
 *
 * A deliberate near-copy of `auth/api-key.ts` rather than a reuse of it, and the
 * duplication is the point. See the note on the `mcp_keys` table: a device key
 * is verified by two separate implementations, one of them in another
 * repository, and neither would honour a scope column. Sharing the table would
 * make "read-only" a claim rather than a property. Sharing the *verifier* would
 * be worse — one function returning either a device or an agent depending on a
 * column is exactly the kind of thing that gets a null-check refactored out of
 * it.
 *
 * What is genuinely shared is the crypto: the same AES-256-GCM wrapper, so
 * there is one place where the storage of a secret is decided.
 */

import crypto from 'crypto';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import { mcp_keys, profiles } from '$lib/server/db/schema';
import { decryptCredential, encryptCredential } from '$lib/server/auth/crypto';

/**
 * Distinct from `sjs_` so the two kinds of credential are told apart before any
 * lookup. Pasting an MCP key into a tunnel client, or the reverse, fails at the
 * format check rather than at a database round trip that might match.
 */
export const MCP_KEY_PREFIX = 'sjsmcp_';

const KEY_LENGTH_BYTES = 32;

/**
 * What a key is allowed to do, in increasing order of trust.
 *
 * This is only ever a *ceiling*. A tier's own rule is the floor and the scope
 * cannot lower it: `write` does not make a Tier 2 overwrite direct, because
 * there is no scope that approves on the user's behalf. See `mcp/tiers.ts`.
 */
export const MCP_SCOPES = ['read', 'propose', 'write'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export function isMcpScope(value: unknown): value is McpScope {
	return typeof value === 'string' && (MCP_SCOPES as readonly string[]).includes(value);
}

/** A key that verified: who it speaks for, and how far. */
export interface VerifiedMcpKey {
	keyId: number;
	userId: string;
	profileId: number;
	scope: McpScope;
	name: string;
}

export function hashMcpKey(key: string): string {
	return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateMcpKey(): { key: string; hash: string } {
	const key = `${MCP_KEY_PREFIX}${crypto.randomBytes(KEY_LENGTH_BYTES).toString('hex')}`;
	return { key, hash: hashMcpKey(key) };
}

/**
 * Recover a stored key for display, or null when it cannot be read.
 *
 * The prefix check does the same work it does for device keys:
 * `decryptCredential` passes non-ciphertext through unchanged so values could be
 * migrated in place, which makes "failed to decrypt" and "was never encrypted"
 * indistinguishable by return value alone. A key has a known shape, so they are
 * distinguishable by inspection.
 */
export function readStoredMcpKey(stored: string | null): string | null {
	if (!stored) return null;
	try {
		const value = decryptCredential(stored);
		return value?.startsWith(MCP_KEY_PREFIX) ? value : null;
	} catch {
		return null;
	}
}

/**
 * Verify a presented key.
 *
 * Returns null for every kind of failure — unknown, revoked, expired, wrong
 * prefix, or bound to a profile that has since been deleted. The caller answers
 * all of them with the same 401: an agent learning *why* a key failed learns
 * which keys exist.
 */
export async function verifyMcpKey(key: string): Promise<VerifiedMcpKey | null> {
	if (!key || !key.startsWith(MCP_KEY_PREFIX)) return null;

	try {
		const [row] = await db
			.select({
				id: mcp_keys.id,
				user_id: mcp_keys.user_id,
				profile_id: mcp_keys.profile_id,
				scope: mcp_keys.scope,
				name: mcp_keys.name,
				revoked: mcp_keys.revoked,
				expires_at: mcp_keys.expires_at,
				// Joined rather than checked afterwards: a key bound to a profile that
				// no longer belongs to its user must not authorize anything, and the
				// cascade only covers deletion, not a profile that changed hands.
				owner_id: profiles.user_id
			})
			.from(mcp_keys)
			.leftJoin(profiles, eq(profiles.id, mcp_keys.profile_id))
			.where(eq(mcp_keys.key_hash, hashMcpKey(key)))
			.limit(1);

		if (!row) return null;
		if (row.revoked) return null;
		if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
		if (row.owner_id !== row.user_id) return null;
		if (!isMcpScope(row.scope)) return null;

		// Fire and forget, like the device-key path: a failure to stamp last_used
		// must not fail the call it is describing.
		db.update(mcp_keys)
			.set({ last_used: new Date() })
			.where(eq(mcp_keys.id, row.id))
			.catch(() => {
				// The next call tries again.
			});

		return {
			keyId: row.id,
			userId: row.user_id,
			profileId: row.profile_id,
			scope: row.scope,
			name: row.name
		};
	} catch (e) {
		// Logged rather than swallowed: a database outage that looks like an auth
		// failure is how an incident gets diagnosed as a permissions problem.
		console.error('[mcp] key verification failed', e);
		return null;
	}
}

/**
 * Mint a key for one of the user's own profiles.
 *
 * The profile is re-checked against the user here rather than trusted from the
 * form, for the ordinary reason: this is the moment a credential is bound, and
 * a mistake binds an agent to someone else's history permanently.
 */
export async function createMcpKey(opts: {
	userId: string;
	profileId: number;
	name: string;
	scope: McpScope;
	expiresAt?: Date | null;
}): Promise<{ id: number; key: string } | null> {
	const [owned] = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(and(eq(profiles.id, opts.profileId), eq(profiles.user_id, opts.userId)))
		.limit(1);
	if (!owned) return null;

	const { key, hash } = generateMcpKey();

	const [created] = await db
		.insert(mcp_keys)
		.values({
			user_id: opts.userId,
			profile_id: opts.profileId,
			name: opts.name,
			key_hash: hash,
			key_encrypted: encryptCredential(key),
			scope: opts.scope,
			expires_at: opts.expiresAt ?? null
		})
		.returning({ id: mcp_keys.id });

	return { id: created.id, key };
}

export interface McpKeyListing {
	id: number;
	name: string;
	profileId: number;
	profileName: string | null;
	scope: McpScope;
	revoked: boolean;
	expiresAt: Date | null;
	lastUsed: Date | null;
	createdAt: Date;
	/** The key itself where it is still readable, for a client that needs re-configuring. */
	key: string | null;
}

export async function listMcpKeys(userId: string): Promise<McpKeyListing[]> {
	const rows = await db
		.select({
			id: mcp_keys.id,
			name: mcp_keys.name,
			profile_id: mcp_keys.profile_id,
			profile_name: profiles.name,
			scope: mcp_keys.scope,
			revoked: mcp_keys.revoked,
			expires_at: mcp_keys.expires_at,
			last_used: mcp_keys.last_used,
			date_created: mcp_keys.date_created,
			key_encrypted: mcp_keys.key_encrypted
		})
		.from(mcp_keys)
		.leftJoin(profiles, eq(profiles.id, mcp_keys.profile_id))
		.where(eq(mcp_keys.user_id, userId))
		.orderBy(desc(mcp_keys.date_created));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		profileId: row.profile_id,
		profileName: row.profile_name,
		scope: isMcpScope(row.scope) ? row.scope : 'read',
		revoked: row.revoked,
		expiresAt: row.expires_at,
		lastUsed: row.last_used,
		createdAt: row.date_created,
		key: readStoredMcpKey(row.key_encrypted)
	}));
}

/**
 * Revoke, rather than delete.
 *
 * The requests a key made outlive it — `capability_requests.mcp_key_id` is what
 * answers "what was this agent asking for before I turned it off", which is the
 * question a revocation is usually prompted by. Deleting the row would set
 * those to null and take the answer with it.
 */
export async function revokeMcpKey(keyId: number, userId: string): Promise<boolean> {
	const revoked = await db
		.update(mcp_keys)
		.set({ revoked: true })
		.where(and(eq(mcp_keys.id, keyId), eq(mcp_keys.user_id, userId), eq(mcp_keys.revoked, false)))
		.returning({ id: mcp_keys.id });

	return revoked.length > 0;
}
