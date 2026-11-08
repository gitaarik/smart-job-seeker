/**
 * A short-lived permission to put one file on one activity entry.
 *
 * ## Why a file cannot simply be a tool argument
 *
 * It can, and it is useless. A tool argument travels through the model's
 * context, so a base64 file is paid for in tokens by whoever calls it: the
 * six-page scanned contract this was built for is 3.2 MB, which is 4.3 MB of
 * base64 and something like 1.4 million tokens. It fits in no context window,
 * and it would be an absurd way to move bytes if it did. Anything small enough
 * to send that way is small enough to paste as text.
 *
 * So the bytes go out of band: this mints a grant, the client PUTs the file
 * straight at `/api/mcp/upload`, and the model never sees a byte of it.
 *
 * ## Why signed rather than stored
 *
 * The same trade `github/app-state.ts` makes, for the same reasons: a signature
 * proves the grant came from us without a table, a cleanup job, or a second
 * round trip — and this server is stateless on purpose (see protocol.ts), so a
 * table of pending uploads would be the second copy of exactly the problem that
 * keeps this app from running two nodes behind a load balancer.
 *
 * It reuses `SJS_AUTH_SECRET`, already trusted to sign session cookies, rather
 * than introducing another key to manage.
 *
 * ## Single use, without any state to keep
 *
 * A signature alone cannot be spent, so a replayed grant would attach the same
 * file twice. This does not carry a nonce to solve that; it names the RECORD,
 * and the endpoint refuses a record whose `file_id` is already set. The column
 * is documented as immutable, so the invariant was already there to lean on —
 * the second attempt finds the slot filled and stops, and no table had to
 * remember anything.
 *
 * The grant is therefore not a capability to create an entry. It is permission
 * to fill one hole in one entry that already exists, which is also what makes a
 * leaked grant cheap: the worst it buys is one file on one entry of one profile,
 * for fifteen minutes, and only while that entry has no file yet.
 *
 * ## The link is the credential
 *
 * Until 2026-11-08 the PUT had to carry the agent's API key as well, so that a
 * grant found in a shell history or a proxy log was not a way in on its own.
 * That asked agents for something their clients keep from them. An MCP client
 * holds the key for its own connection and does not hand it to the shell the
 * model runs commands in: Claude Code keeps it in its config, and its auto mode
 * refuses, rightly, to dig it out. The agents that could comply were the ones
 * willing to paste a long-lived key into a curl command, which writes it into
 * the very shell history the rule was guarding.
 *
 * So the grant alone authorizes the upload, as a presigned URL does. It carries
 * the id of the key it was issued to, and the endpoint looks that key up again:
 * revoking a key, letting it expire or narrowing it to read closes its links
 * too, and the secret never has to leave the client. What a leaked link buys is
 * what the paragraph above says, and no more.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '$lib/tools/get-env';

/**
 * Long enough to move a large file on a slow link, short enough that a grant
 * found in a log later is already dead.
 */
export const GRANT_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * The ceiling the endpoint enforces, matching the composer's own.
 *
 * Same number as `MAX_FILE_BYTES` on the activity page deliberately: a limit
 * that differs by door is one a person runs into after choosing the wrong door.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function sign(payload: string): string {
	return createHmac('sha256', getEnv('SJS_AUTH_SECRET')).update(payload).digest('base64url');
}

export interface UploadGrant {
	/** The key it was issued to, checked again at upload time. */
	keyId: number;
	profileId: number;
	applicationId: number;
	recordId: number;
}

/**
 * A filename is part of what is signed.
 *
 * Not for display — the endpoint could take that from the request. It is signed
 * because the extension decides how the file is stored and how extraction reads
 * it, and letting the uploader choose it at PUT time would mean the grant said
 * "a PDF on entry 73" while the bytes arrived as something else.
 */
export function signUploadGrant(grant: UploadGrant, filename: string, nowMs = Date.now()): string {
	const { keyId, profileId, applicationId, recordId } = grant;
	const payload = [nowMs, keyId, profileId, applicationId, recordId, filename].join(':');
	return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

export interface VerifiedGrant extends UploadGrant {
	filename: string;
}

/** The grant this token carries, or null if it is forged, malformed or stale. */
export function verifyUploadGrant(token: string, nowMs = Date.now()): VerifiedGrant | null {
	const [encoded, signature] = token.split('.');
	if (!encoded || !signature) return null;

	let payload: string;
	try {
		payload = Buffer.from(encoded, 'base64url').toString('utf8');
	} catch {
		return null;
	}

	const expected = sign(payload);
	// Both to Buffers first: timingSafeEqual throws on a length mismatch, which
	// on its own would leak the signature's length through an exception.
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

	// A filename may contain ':', so the split is bounded and the tail rejoined.
	// A grant from before the key's id joined the payload has one field fewer,
	// fails this count or the endpoint's key check, and was dead in 15 minutes.
	const parts = payload.split(':');
	if (parts.length < 6) return null;
	const [issued, keyId, profileId, applicationId, recordId] = parts.slice(0, 5).map(Number);
	const filename = parts.slice(5).join(':');

	if (!Number.isFinite(issued) || nowMs - issued > GRANT_MAX_AGE_MS || issued > nowMs) return null;
	if (![keyId, profileId, applicationId, recordId].every(Number.isInteger)) return null;
	if (!filename) return null;

	return { keyId, profileId, applicationId, recordId, filename };
}
