/**
 * The door bytes come in through.
 *
 * Separate from `/api/mcp` because it is not JSON-RPC and must not be: a file
 * arriving as a tool argument travels through the model's context, which for
 * anything worth attaching costs more tokens than a context window holds. The
 * agent asks for a link with `request_file_upload` and then PUTs the file here
 * itself, so the bytes are never seen by the model at all.
 *
 * ## Two credentials, both required
 *
 * The signed grant says *what* may be written — one file, on one entry, of one
 * profile, for fifteen minutes. The bearer key says *who* is asking. Requiring
 * both means a grant found in a shell history or a proxy log is not on its own
 * a way in, and a valid key is not a way to write to an entry it was not given
 * a grant for.
 *
 * The two must also agree: a key for profile A may not spend a grant issued for
 * profile B, even though both are individually valid.
 */

import type { RequestHandler } from './$types';
import { verifyMcpKey } from '$lib/server/mcp/keys';
import { MAX_UPLOAD_BYTES, verifyUploadGrant } from '$lib/server/mcp/upload-grants';
import { attachFileToRecord } from '$lib/server/applications/record-files';
import { mcpRateLimiter, createRateLimitResponse } from '$lib/server/middleware/rate-limit';

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

function unauthorized(): Response {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
		status: 401,
		headers: {
			'content-type': 'application/json',
			'www-authenticate': 'Bearer realm="smart-job-seeker"'
		}
	});
}

export const PUT: RequestHandler = async ({ request, url }) => {
	const header = request.headers.get('authorization');
	const [scheme, token] = header?.split(' ') ?? [];
	if (!token || scheme?.toLowerCase() !== 'bearer') return unauthorized();

	const key = await verifyMcpKey(token);
	if (!key) return unauthorized();

	if (!mcpRateLimiter.tryConsumeKey(`mcp:${key.keyId}`)) {
		return createRateLimitResponse(mcpRateLimiter.retryAfterSeconds());
	}

	if (key.scope === 'read') {
		return json({ error: 'This key is read-only, so it cannot attach anything.' }, 403);
	}

	const grantToken = url.searchParams.get('grant');
	if (!grantToken) return json({ error: 'No grant. Call request_file_upload first.' }, 400);

	const grant = verifyUploadGrant(grantToken);
	if (!grant) {
		return json(
			{ error: 'That upload link is not valid any more. Call request_file_upload for a new one.' },
			403
		);
	}

	// Individually valid is not the same as valid together.
	if (grant.profileId !== key.profileId) {
		return json({ error: 'That upload link was not issued to this key.' }, 403);
	}

	// The declared length first, so an oversized body is refused before it is
	// read into memory rather than after.
	const declared = Number(request.headers.get('content-length') ?? '');
	if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
		return json({ error: `That file is larger than the ${MAX_UPLOAD_BYTES} byte limit.` }, 413);
	}

	const buffer = Buffer.from(await request.arrayBuffer());
	if (buffer.length === 0) {
		return json({ error: 'The request body was empty — send the file as the raw body.' }, 400);
	}
	// Again on the real bytes: content-length is the client's claim about them.
	if (buffer.length > MAX_UPLOAD_BYTES) {
		return json({ error: `That file is larger than the ${MAX_UPLOAD_BYTES} byte limit.` }, 413);
	}

	const result = await attachFileToRecord({
		recordId: grant.recordId,
		applicationId: grant.applicationId,
		profileId: grant.profileId,
		// From the grant, not from the request: the extension decides how the file
		// is typed and read, and it was signed so that the link and the bytes
		// cannot disagree about what arrived.
		filename: grant.filename,
		buffer
	});

	if ('error' in result) return json({ error: result.error }, 409);

	return json({
		attached: true,
		entry_id: grant.recordId,
		file_id: result.fileId,
		bytes: buffer.length,
		extracted: result.extracted,
		message: result.extracted
			? `Attached to entry ${grant.recordId}, and its text was read into the entry.`
			: `Attached to entry ${grant.recordId}. No text could be read out of it — normal ` +
				`for a photograph or a scan with no text layer. The file is on the entry and ` +
				`downloadable; what the entry says is unchanged.`
	});
};
