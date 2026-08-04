import type { Actions, PageServerLoad } from "./$types";
import { type ActionFailure, type Cookies, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { application_records, applications } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../profile/utils";
import {
  deriveRecordTitle,
  recordTypeValues,
  today,
} from "$lib/application-records";
import { deleteFile, uploadFile } from "$lib/server/files";
import { extractRecordFile } from "$lib/server/ai-chat/application-activity";
import { deriveRecordMetadata } from "$lib/server/ai-chat/record-derivation";
import { summarizeApplication } from "$lib/server/ai-chat/application-summary";
import { Buffer } from "buffer";

/**
 * The status log comes from the layout, which loads it for every tab. The
 * entries' *text* does not: this is the only page that renders it, and leaving
 * it in the layout meant the overview, texts and salary tabs each shipped every
 * transcript on the application to the browser to display none of it. The
 * layout still carries each entry's metadata — this query is the text.
 */
export const load: PageServerLoad = async ({ parent }) => {
  const { application } = await parent();

  const records = await db.query.application_records.findMany({
    where: eq(application_records.application_id, application.id),
    columns: { id: true, content: true },
  });

  return {
    // Keyed by id rather than returned as a list, because the layout already
    // owns the ordering and the two would drift the first time it changed.
    recordContent: Object.fromEntries(
      records.map((r) => [r.id, r.content ?? ""]),
    ) as Record<number, string>,
    // Label for the assistant's "I can see this page" chip. The entries
    // themselves are resolved server-side — see ai-chat/chat-context.ts.
    chatContext: { label: "Application activity" },
  };
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type Denial = ActionFailure<{ error: string }>;
type Resolved =
  | {
    app: { id: number; status: string; status_step: string | null };
    profileId: number;
    error: null;
  }
  | { app: null; profileId: null; error: Denial };

/**
 * Resolve the application for the current user's selected profile, so every
 * action fails closed rather than trusting the id in the URL. Returns the
 * status fields too, because the composer defaults a new entry's stage from
 * where the application currently is.
 */
async function requireApplication(
  locals: App.Locals,
  cookies: Cookies,
  idParam: string,
): Promise<Resolved> {
  const deny = (error: Denial): Resolved => ({
    app: null,
    profileId: null,
    error,
  });

  const user = locals.user;
  if (!user) return deny(fail(401, { error: "Not authenticated" }));

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) return deny(fail(400, { error: "No profile selected" }));

  const appId = parseInt(idParam);
  if (isNaN(appId)) return deny(fail(400, { error: "Invalid application ID" }));

  const existing = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, appId),
      eq(applications.profile_id, profileId),
    ),
    columns: { id: true, status: true, status_step: true },
  });
  if (!existing) return deny(fail(404, { error: "Application not found" }));

  return { app: existing, profileId, error: null };
}

function readOptionalType(formData: FormData): string | null {
  const raw = (formData.get("record_type") as string | null)?.trim() || "";
  // Unknown types would render as the fallback label and be invisible to the
  // filters — reject rather than silently store them.
  return recordTypeValues.includes(raw) ? raw : null;
}

export const actions: Actions = {
  /**
   * One action for both input methods, because they are the same entry: text,
   * a file, or both. Nothing about type/stage/date/title is asked for — each
   * is derived, and each stays editable afterwards.
   */
  create: async ({ request, locals, cookies, params }) => {
    const resolved = await requireApplication(locals, cookies, params.id);
    if (resolved.error) return resolved.error;

    const formData = await request.formData();
    const content = (formData.get("content") as string | null)?.trim() || "";
    const upload = formData.get("file");
    const file = upload instanceof File && upload.size > 0 ? upload : null;

    if (!content && !file) {
      return fail(400, { error: "Paste something, or attach a file." });
    }
    if (file && file.size > MAX_FILE_BYTES) {
      return fail(400, { error: `${file.name} exceeds the 10MB limit` });
    }

    let fileId: string | null = null;
    if (file) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await uploadFile({
          filename: file.name,
          buffer,
          title: file.name,
        });
        fileId = stored.id;
      } catch (err) {
        return fail(400, { error: (err as Error).message });
      }
    }

    const [created] = await db.insert(application_records).values({
      application_id: resolved.app.id,
      // A file someone attached is far more likely received than written, so
      // it defaults to `message`; typed text defaults to the authored kind.
      // Both are re-typed by the derivation pass when that lands.
      record_type: readOptionalType(formData) ?? (file ? "message" : "note"),
      title: content ? deriveRecordTitle(content) : (file?.name ?? "Untitled"),
      content: content || null,
      // The stage the application is in right now, because things are logged
      // as they happen. Free, and right far more often than an LLM guess.
      step: resolved.app.status_step,
      event_date: today(),
      file_id: fileId,
      extraction_status: fileId ? "pending" : "none",
      date_created: new Date(),
    }).returning({ id: application_records.id });

    // A file-backed entry has no content yet, so its derivation rides the
    // extract action instead — there would be nothing to read here.
    if (!fileId) {
      await deriveRecordMetadata(created.id, resolved.profileId);
      // After derivation, so the digest sees the real type and contacts rather
      // than the write-time fallbacks.
      await summarizeApplication(resolved.app.id, resolved.profileId);
    }

    // Reported so the client can kick off extraction as a second request —
    // the entry is already written and visible, and a 40-page PDF must not
    // hold the composer open while it is read.
    return {
      success: true,
      createdId: created.id,
      needsExtraction: !!fileId,
    };
  },

  /**
   * Extract a just-uploaded file into the record's content. Separate from
   * `create` on purpose: see the comment there. Idempotent.
   */
  extract: async ({ request, locals, cookies, params }) => {
    const resolved = await requireApplication(locals, cookies, params.id);
    if (resolved.error) return resolved.error;

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid record ID" });

    // Re-authorize the record against the application, not just the id: the
    // client supplies it and nothing else here checks ownership.
    const record = await db.query.application_records.findFirst({
      where: and(
        eq(application_records.id, id),
        eq(application_records.application_id, resolved.app.id),
      ),
      columns: { id: true },
    });
    if (!record) return fail(404, { error: "Record not found" });

    const text = await extractRecordFile(id);
    // Now there is content to read, so this is where a file-backed entry gets
    // its real title, type, date and contacts.
    if (text) {
      await deriveRecordMetadata(id, resolved.profileId);
      await summarizeApplication(resolved.app.id, resolved.profileId);
    }
    // A file with no extractable text (an image, a scan) is not an error — the
    // entry and the download still stand. extractRecordFile has already marked
    // it "skipped" so nothing retries it.
    return { success: true, extracted: !!text };
  },

  update: async ({ request, locals, cookies, params }) => {
    const resolved = await requireApplication(locals, cookies, params.id);
    if (resolved.error) return resolved.error;

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid record ID" });

    const record = await db.query.application_records.findFirst({
      where: and(
        eq(application_records.id, id),
        eq(application_records.application_id, resolved.app.id),
      ),
      columns: { id: true },
    });
    if (!record) return fail(404, { error: "Record not found" });

    // Absent field means "leave alone", NOT "clear". The composer derives
    // `step` and `event_date`, and an edit form that only carries title and
    // content would otherwise silently wipe both — the same authoritative-vs-
    // merge trap that keeps job details and job descriptions separate
    // capabilities in the assistant.
    const optional = (key: string) => {
      const raw = formData.get(key);
      return raw === null ? undefined : ((raw as string).trim() || null);
    };

    const title = (formData.get("title") as string | null)?.trim() || "";

    await db.update(application_records).set({
      record_type: readOptionalType(formData) ?? undefined,
      title: title || "Untitled",
      content: optional("content"),
      step: optional("step"),
      event_date: optional("event_date"),
      date_updated: new Date(),
    }).where(eq(application_records.id, id));

    await summarizeApplication(resolved.app.id, resolved.profileId);
    return { success: true };
  },

  delete: async ({ request, locals, cookies, params }) => {
    const resolved = await requireApplication(locals, cookies, params.id);
    if (resolved.error) return resolved.error;

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid record ID" });

    const record = await db.query.application_records.findFirst({
      where: and(
        eq(application_records.id, id),
        eq(application_records.application_id, resolved.app.id),
      ),
      columns: { id: true, file_id: true },
    });
    if (!record) return fail(404, { error: "Record not found" });

    await db.delete(application_records).where(eq(application_records.id, id));

    // The blob goes with the entry. The FK is ON DELETE SET NULL so the row
    // would survive an orphaned file, but nothing would ever reach it again.
    if (record.file_id) {
      try {
        await deleteFile(record.file_id);
      } catch {
        // Already gone, or storage hiccup — the record is what mattered.
      }
    }

    // A deletion changes the digest as surely as an addition does, and a
    // summary describing an entry that no longer exists is worse than none.
    await summarizeApplication(resolved.app.id, resolved.profileId);
    return { success: true };
  },
};
