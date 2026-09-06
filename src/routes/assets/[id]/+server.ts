import { error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { sql } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';
import type { RequestHandler } from './$types';

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'files');

/**
 * Public assets, addressed by file id.
 *
 * Unauthenticated by design: a shared resume and a public profile page render
 * these to readers who are not signed in, and a rendered PDF fetches them the
 * same way. There is no caller to ask about, which is the whole difficulty.
 *
 * **`files` is a shared table and most of it is not public.** It holds CVs sent
 * with applications, profile export archives, activity-entry attachments,
 * feedback uploads, project images, the CV a profile was created from, and the
 * uploads `import_logs` keeps for re-parsing. This route used to serve a row to
 * anyone who named it, so every one of those was one guessed uuid from being
 * read, at `public, max-age=31536000`.
 *
 * So it answers for a file that is *reachable as a public asset*, and 404s for
 * everything else. An allowlist and not a denylist on purpose: the failure of
 * forgetting to add a shape here is an image that does not load, which someone
 * notices; the failure of forgetting to exclude one is a private file served
 * for a year, which nobody does.
 *
 * Only resume template artwork is public now. Profile pictures and the two
 * entity logo columns were here too, from when images were `files` rows rather
 * than bytes under `uploads/`; those columns are gone and the clauses went with
 * them. Anything served from `uploads/` never reaches this route at all.
 *
 * The template check reads `resume_template_assets`, which is an indexed
 * lookup. It used to be `config::text ILIKE '%<id>%'` over the jsonb, because
 * the ids lived in there; they are rows now, so this is the one branch that
 * stopped being a scan.
 *
 * Everything private has a door of its own that checks who is asking:
 * `/api/profile/[id]/documents/[docId]/download` for project attachments,
 * `/applications/[id]/activity/download` for what was sent, the profile-export
 * download, and `/admin/files/download` for the file browser.
 */
const PUBLIC_REFERENCES = sql`
	EXISTS (SELECT 1 FROM resume_template_assets WHERE file_id = files.id)
`;

/**
 * `files.id` is a `uuid` column, so a path segment that isn't one reaches
 * Postgres as an invalid cast and comes back as a 500, not the 404 the route
 * means. Scanners probe this prefix constantly — `/assets/.env`,
 * `/assets/mail.json`, `/assets/manifest.json` — and every probe was landing in
 * GlitchTip as an application error with the failing query and its parameters
 * in the title (9 issues, 84 events). `isFrameworkClientError` never saw them:
 * it matches SvelteKit's own `Not found:` message, and this failed a step
 * earlier than that.
 *
 * Checking the shape first turns those back into the 404 they always were.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AssetRow {
	filename_disk: string | null;
	type: string | null;
	is_public: boolean;
}

export const GET: RequestHandler = async ({ params }) => {
	if (!UUID_RE.test(params.id)) throw error(404);

	// One statement, so the lookup and the public test cannot disagree — and so
	// that "a row exists but is not public" stays distinguishable from "no row",
	// which is the only warning worth logging here.
	const rows = await queryRawDirect<AssetRow>(sql`
		SELECT filename_disk, type, (${PUBLIC_REFERENCES}) AS is_public
		  FROM files
		 WHERE id = ${params.id}::uuid
	`);
	const file = rows[0];

	if (!file) throw error(404);
	if (!file.is_public) {
		// Either a private file someone is probing for, or a genuinely public
		// kind that nothing above knows about yet. The second reads as an image
		// that silently stopped loading, so leave a breadcrumb for it.
		console.warn(`[assets] refused non-public file ${params.id}`);
		throw error(404);
	}
	if (!file.filename_disk) throw error(404);

	let buffer: Buffer;
	try {
		buffer = await readFile(join(UPLOADS_DIR, file.filename_disk));
	} catch {
		throw error(404);
	}

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': file.type || 'application/octet-stream',
			// The allowlist decides which files are served; this decides they are
			// served as what they claim to be. Sniffing is how a stored blob on the
			// app origin turns into a document the browser will execute.
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
