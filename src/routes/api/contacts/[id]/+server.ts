import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAuth, parseIntParam } from "$lib/server/utils/api-helpers";
import { acceptContact, declineContact, removeContact } from "$lib/server/contacts";

/**
 * PATCH /api/contacts/[id] — Accept or decline a contact request
 * Body: { action: "accept" | "decline" }
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const contactId = parseIntParam(params.id, "contact");
  const body = await request.json();

  if (body.action === "accept") {
    const accepted = await acceptContact(contactId, user.id);
    if (!accepted) {
      throw error(404, "Contact request not found");
    }
    return json({ success: true });
  }

  if (body.action === "decline") {
    const declined = await declineContact(contactId, user.id);
    if (!declined) {
      throw error(404, "Contact request not found");
    }
    return json({ success: true });
  }

  throw error(400, "Invalid action — use 'accept' or 'decline'");
};

/**
 * DELETE /api/contacts/[id] — Remove a contact
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const contactId = parseIntParam(params.id, "contact");

  const removed = await removeContact(contactId, user.id);
  if (!removed) {
    throw error(404, "Contact not found");
  }

  return json({ success: true });
};
