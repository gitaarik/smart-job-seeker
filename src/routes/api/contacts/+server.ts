import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { listContacts, sendContactRequest } from "$lib/server/contacts";

/**
 * GET /api/contacts — List all contacts for the current user
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = requireAuth(locals);
  const contacts = await listContacts(user.id);
  return json({ contacts });
};

/**
 * POST /api/contacts — Send a contact request
 * Body: { email: string }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);
  const body = await request.json();

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return json({ error: "Email address is required" }, { status: 400 });
  }

  const result = await sendContactRequest(user.id, email);

  if (!result.success) {
    return json({ error: result.error }, { status: 400 });
  }

  return json({ contact: result.contact });
};
