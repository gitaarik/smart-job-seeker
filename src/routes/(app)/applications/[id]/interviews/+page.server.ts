import type { Actions, PageServerLoad } from "./$types";
import { type ActionFailure, type Cookies, fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { application_records, applications } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../../profile/utils";
import { recordTypeValues } from "$lib/application-records";

export const load: PageServerLoad = async ({ parent }) => {
  const { application } = await parent();

  // Label for the assistant's "I can see this page" chip. The records
  // themselves are resolved server-side — see ai-chat/chat-context.ts.
  return { chatContext: { label: "Interview records" } };
};

/**
 * Resolve the application for the current user's selected profile, so every
 * action fails closed rather than trusting the id in the URL.
 */
type Denial = ActionFailure<{ error: string }>;

type Resolved =
  | { appId: number; error: null }
  | { appId: null; error: Denial };

async function requireApplication(
  locals: App.Locals,
  cookies: Cookies,
  idParam: string,
): Promise<Resolved> {
  const deny = (error: Denial): Resolved => ({ appId: null, error });

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
  });
  if (!existing) return deny(fail(404, { error: "Application not found" }));

  return { appId, error: null };
}

function readForm(formData: FormData) {
  const recordType = (formData.get("record_type") as string | null)?.trim() ||
    "";
  const eventDate = (formData.get("event_date") as string | null)?.trim() || "";
  return {
    title: (formData.get("title") as string | null)?.trim() || "",
    content: (formData.get("content") as string | null)?.trim() || null,
    step: (formData.get("step") as string | null)?.trim() || null,
    // Unknown types would render as "Other" and be invisible to the filters —
    // reject rather than silently store them.
    record_type: recordTypeValues.includes(recordType) ? recordType : null,
    event_date: eventDate || null,
  };
}

export const actions: Actions = {
  create: async ({ request, locals, cookies, params }) => {
    const resolved = await requireApplication(locals, cookies, params.id);
    if (resolved.error) return resolved.error;

    const formData = await request.formData();
    const values = readForm(formData);
    const statusLog = parseInt(formData.get("status_log") as string);

    if (!values.title) return fail(400, { error: "Title is required" });
    if (!values.record_type) return fail(400, { error: "Unknown record type" });

    const [created] = await db.insert(application_records).values({
      application_id: resolved.appId,
      record_type: values.record_type,
      title: values.title,
      content: values.content,
      step: values.step,
      event_date: values.event_date,
      status_log: isNaN(statusLog) ? null : statusLog,
      date_created: new Date(),
    }).returning({ id: application_records.id });

    return { success: true, createdId: created.id };
  },

  update: async ({ request, locals, cookies, params }) => {
    const resolved = await requireApplication(locals, cookies, params.id);
    if (resolved.error) return resolved.error;

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid record ID" });

    const values = readForm(formData);
    if (!values.title) return fail(400, { error: "Title is required" });
    if (!values.record_type) return fail(400, { error: "Unknown record type" });

    const record = await db.query.application_records.findFirst({
      where: and(
        eq(application_records.id, id),
        eq(application_records.application_id, resolved.appId),
      ),
    });
    if (!record) return fail(404, { error: "Record not found" });

    await db.update(application_records).set({
      record_type: values.record_type,
      title: values.title,
      content: values.content,
      step: values.step,
      event_date: values.event_date,
      date_updated: new Date(),
    }).where(eq(application_records.id, id));

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
        eq(application_records.application_id, resolved.appId),
      ),
    });
    if (!record) return fail(404, { error: "Record not found" });

    await db.delete(application_records).where(eq(application_records.id, id));

    return { success: true };
  },
};
