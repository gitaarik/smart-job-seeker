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

/**
 * What a key is allowed to SEE — the second dimension, and the newer one.
 *
 * `record` is the applicant's own structured history: their profile, their
 * jobs, their applications, what has been changed. `documents` adds the text of
 * the things other people sent them — an offer, a recruiter's email, an
 * interview transcript, an uploaded archive.
 *
 * The split is drawn there because that is where authorship changes. Everything
 * under `record` was written by the applicant or by this application; the text
 * a `documents` key reads was written by somebody else and can say anything,
 * including things addressed to the agent reading it. That is the whole of
 * `PROMPT-INJECTION.md` §10, and this is its answer: an applicant who wants an
 * agent tidying their CV does not have to hand it their correspondence too.
 *
 * The INDEX stays either way — an application's chronology names its entries at
 * both levels, because `add_activity_record` needs it to avoid logging the same
 * thing twice, and a title is not the document. What `record` never returns is
 * the text.
 */
export const MCP_READ_SCOPES = ['record', 'documents'] as const;
export type McpReadScope = (typeof MCP_READ_SCOPES)[number];

export function isMcpReadScope(value: unknown): value is McpReadScope {
	return typeof value === 'string' && (MCP_READ_SCOPES as readonly string[]).includes(value);
}

/** A key that verified: who it speaks for, how far, and how much it sees. */
export interface VerifiedMcpKey {
	keyId: number;
	userId: string;
	profileId: number;
	scope: McpScope;
	readScope: McpReadScope;
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
				read_scope: mcp_keys.read_scope,
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
		// A read scope this build does not recognise is refused rather than
		// narrowed to `record`. A value only gets into that column from a future
		// version, and quietly reading a key as less permissive than it was minted
		// is a support call; refusing it is one line in a log.
		if (!isMcpReadScope(row.read_scope)) return null;

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
			readScope: row.read_scope,
			name: row.name
		};
	} catch (e) {
		// Logged rather than swallowed: a database outage that looks like an auth
		// failure is how an incident gets diagnosed as a permissions problem.
		console.error('[mcp] key verification failed', e);
		return null;
	}
}

/** The column widths of `client_name` and `client_version`. */
const CLIENT_NAME_MAX = 100;
const CLIENT_VERSION_MAX = 50;

/** What a client said it was when it connected. Either half may be missing. */
export interface McpClientInfo {
	name: string | null;
	version: string | null;
}

/**
 * One `clientInfo` string, made fit to show.
 *
 * Format characters are dropped, because a right-to-left override can make one
 * name read as another. Control characters and runs of whitespace fold to one
 * space. The cut is by code point, which is how Postgres counts a varchar, so
 * it never splits a surrogate pair. Anything that is not a non-empty string is
 * null.
 */
function cleanClientText(value: unknown, max: number): string | null {
	if (typeof value !== 'string') return null;
	const text = value
		.replace(/\p{Cf}/gu, '')
		.replace(/[\p{Cc}\s]+/gu, ' ')
		.trim();
	return text ? Array.from(text).slice(0, max).join('').trim() : null;
}

/**
 * Read the `clientInfo` of an `initialize` request.
 *
 * The spec's own rule picks the name: `title` is the one meant for people, and
 * `name` stands in when a client gives no title. Nothing is checked beyond
 * being fit to show, because nothing is decided on it; see the note on
 * `mcp_keys.client_name`.
 */
export function readMcpClientInfo(clientInfo: unknown): McpClientInfo {
	if (typeof clientInfo !== 'object' || clientInfo === null) {
		return { name: null, version: null };
	}
	const info = clientInfo as Record<string, unknown>;
	return {
		name:
			cleanClientText(info.title, CLIENT_NAME_MAX) ?? cleanClientText(info.name, CLIENT_NAME_MAX),
		version: cleanClientText(info.version, CLIENT_VERSION_MAX)
	};
}

/**
 * Remember what connected with a key, from its `initialize`.
 *
 * Written on every handshake, including one that names nothing, so the row
 * describes the latest client rather than keeping an older one's name next to
 * a newer one's activity. Fire and forget, like `last_used`: recording the
 * client must not fail the handshake it describes.
 */
export function recordMcpClient(keyId: number, clientInfo: unknown): void {
	const { name, version } = readMcpClientInfo(clientInfo);
	db.update(mcp_keys)
		.set({ client_name: name, client_version: version })
		.where(eq(mcp_keys.id, keyId))
		.catch((e) => {
			// Logged, unlike a missed `last_used`. When this fails it fails on every
			// handshake (a database without the columns), and a name that never
			// appears gives nobody a reason to go and look.
			console.error('[mcp] could not record the connecting client', e);
		});
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
	/** Defaults to the closed end, like the column does. */
	readScope?: McpReadScope;
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
			read_scope: opts.readScope ?? 'record',
			expires_at: opts.expiresAt ?? null
		})
		.returning({ id: mcp_keys.id });

	return { id: created.id, key };
}

/**
 * Where a key stands, as Connected Apps shows it.
 *
 * `waiting` is a key nothing has used yet: every key for the minute after it
 * is made, and a forgotten one after that. `connected` means something has
 * used it, not that anything is using it now. The server is stateless, so
 * there is no connection to be up or down, only the last time something
 * called.
 */
export type McpKeyStatus = 'waiting' | 'connected' | 'revoked' | 'expired';

export function mcpKeyStatus(
	key: { revoked: boolean; expiresAt: Date | null; lastUsed: Date | null },
	now: Date
): McpKeyStatus {
	if (key.revoked) return 'revoked';
	// The test `verifyMcpKey` refuses on, so the page never calls a key
	// connected that the server would turn away.
	if (key.expiresAt && key.expiresAt < now) return 'expired';
	return key.lastUsed ? 'connected' : 'waiting';
}

export interface McpKeyListing {
	id: number;
	name: string;
	profileId: number;
	profileName: string | null;
	scope: McpScope;
	readScope: McpReadScope;
	status: McpKeyStatus;
	revoked: boolean;
	expiresAt: Date | null;
	lastUsed: Date | null;
	/** What the last client to connect called itself; see `mcp_keys.client_name`. */
	clientName: string | null;
	clientVersion: string | null;
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
			read_scope: mcp_keys.read_scope,
			revoked: mcp_keys.revoked,
			expires_at: mcp_keys.expires_at,
			last_used: mcp_keys.last_used,
			client_name: mcp_keys.client_name,
			client_version: mcp_keys.client_version,
			date_created: mcp_keys.date_created,
			key_encrypted: mcp_keys.key_encrypted
		})
		.from(mcp_keys)
		.leftJoin(profiles, eq(profiles.id, mcp_keys.profile_id))
		.where(eq(mcp_keys.user_id, userId))
		.orderBy(desc(mcp_keys.date_created));

	const now = new Date();
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		profileId: row.profile_id,
		profileName: row.profile_name,
		scope: isMcpScope(row.scope) ? row.scope : 'read',
		readScope: isMcpReadScope(row.read_scope) ? row.read_scope : 'record',
		status: mcpKeyStatus(
			{ revoked: row.revoked, expiresAt: row.expires_at, lastUsed: row.last_used },
			now
		),
		revoked: row.revoked,
		expiresAt: row.expires_at,
		lastUsed: row.last_used,
		clientName: row.client_name,
		clientVersion: row.client_version,
		createdAt: row.date_created,
		key: readStoredMcpKey(row.key_encrypted)
	}));
}

/**
 * How long after a key is made Connected Apps keeps checking for its app:
 * long enough to find the connector settings in an unfamiliar client. After
 * that a reload gives the same answer the checking would have.
 */
export const MCP_CONNECT_WATCH_MS = 15 * 60 * 1000;

/**
 * Whether the page should keep checking this key: made in the last few
 * minutes, still usable, and no client has said what it is yet.
 *
 * "Said what it is" rather than "used", because the key's first use and the
 * client's name are two separate writes. Stopping at the first could stop one
 * check before the name lands, and leave the page saying "Connected" with no
 * answer to "connected what?" until someone reloads it.
 */
export function isAwaitingClient(key: McpKeyListing, now: Date): boolean {
	if (key.status !== 'waiting' && key.status !== 'connected') return false;
	if (key.clientName) return false;
	return now.getTime() - key.createdAt.getTime() < MCP_CONNECT_WATCH_MS;
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
