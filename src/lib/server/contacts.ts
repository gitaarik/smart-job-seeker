/**
 * Contacts service — manage user-to-user contact relationships
 */

import { db } from "$lib/server/db";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { contacts, users } from "$lib/server/db/schema";
import { createNotification } from "$lib/server/notifications";

export type ContactStatus = "pending" | "accepted" | "declined";

export interface ContactWithUser {
  id: number;
  status: string;
  date_created: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  direction: "sent" | "received";
}

/**
 * List all contacts for a user (both sent and received, accepted + pending)
 */
export async function listContacts(userId: string): Promise<ContactWithUser[]> {
  const [sent, received] = await Promise.all([
    db.query.contacts.findMany({
      where: and(
        eq(contacts.requester_id, userId),
        inArray(contacts.status, ["pending", "accepted"]),
      ),
      columns: {
        id: true,
        status: true,
        date_created: true,
      },
      with: {
        user_recipient_id: { columns: { id: true, name: true, email: true, image: true } },
      },
      orderBy: desc(contacts.date_created),
    }),
    db.query.contacts.findMany({
      where: and(
        eq(contacts.recipient_id, userId),
        inArray(contacts.status, ["pending", "accepted"]),
      ),
      columns: {
        id: true,
        status: true,
        date_created: true,
      },
      with: {
        user_requester_id: { columns: { id: true, name: true, email: true, image: true } },
      },
      orderBy: desc(contacts.date_created),
    }),
  ]);

  return [
    ...sent.map((c) => ({
      id: c.id,
      status: c.status,
      date_created: c.date_created,
      user: c.user_recipient_id,
      direction: "sent" as const,
    })),
    ...received.map((c) => ({
      id: c.id,
      status: c.status,
      date_created: c.date_created,
      user: c.user_requester_id,
      direction: "received" as const,
    })),
  ];
}

/**
 * List only accepted contacts for a user (for sharing UI)
 */
export async function listAcceptedContacts(userId: string) {
  const allContacts = await listContacts(userId);
  return allContacts.filter((c) => c.status === "accepted");
}

/**
 * Send a contact request by email
 */
export async function sendContactRequest(
  requesterId: string,
  recipientEmail: string,
): Promise<{ success: boolean; error?: string; contact?: ContactWithUser }> {
  // Find recipient by email
  const recipient = await db.query.users.findFirst({
    where: eq(users.email, recipientEmail),
    columns: { id: true, name: true, email: true, image: true },
  });

  if (!recipient) {
    return { success: false, error: "No user found with that email address" };
  }

  if (recipient.id === requesterId) {
    return { success: false, error: "You cannot add yourself as a contact" };
  }

  // Check if contact already exists (in either direction)
  const existing = await db.query.contacts.findFirst({
    where: or(
      and(eq(contacts.requester_id, requesterId), eq(contacts.recipient_id, recipient.id)),
      and(eq(contacts.requester_id, recipient.id), eq(contacts.recipient_id, requesterId)),
    ),
  });

  if (existing) {
    if (existing.status === "accepted") {
      return { success: false, error: "You are already contacts" };
    }
    if (existing.status === "pending") {
      return { success: false, error: "A contact request is already pending" };
    }
    if (existing.status === "declined") {
      // Re-send: update the existing declined request
      await db.update(contacts).set({
        requester_id: requesterId,
        recipient_id: recipient.id,
        status: "pending",
        date_updated: new Date(),
      }).where(eq(contacts.id, existing.id));
      return {
        success: true,
        contact: {
          id: existing.id,
          status: "pending",
          date_created: existing.date_created,
          user: recipient,
          direction: "sent",
        },
      };
    }
  }

  const [created] = await db.insert(contacts).values({
    requester_id: requesterId,
    recipient_id: recipient.id,
  }).returning({ id: contacts.id, date_created: contacts.date_created });

  // Notify the recipient
  const requester = await db.query.users.findFirst({
    where: eq(users.id, requesterId),
    columns: { name: true, email: true },
  });
  const requesterName = requester?.name || requester?.email || "Someone";
  await createNotification({
    userId: recipient.id,
    type: "contact_request",
    title: `${requesterName} sent you a contact request`,
    link: "/contacts",
  }).catch(() => {});

  return {
    success: true,
    contact: {
      id: created.id,
      status: "pending",
      date_created: created.date_created,
      user: recipient,
      direction: "sent",
    },
  };
}

/**
 * Accept a contact request (only the recipient can accept)
 */
export async function acceptContact(contactId: number, userId: string): Promise<boolean> {
  const result = await db.update(contacts).set({
    status: "accepted",
    date_updated: new Date(),
  }).where(and(
    eq(contacts.id, contactId),
    eq(contacts.recipient_id, userId),
    eq(contacts.status, "pending"),
  ));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Decline a contact request (only the recipient can decline)
 */
export async function declineContact(contactId: number, userId: string): Promise<boolean> {
  const result = await db.update(contacts).set({
    status: "declined",
    date_updated: new Date(),
  }).where(and(
    eq(contacts.id, contactId),
    eq(contacts.recipient_id, userId),
    eq(contacts.status, "pending"),
  ));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Remove a contact (either user can remove)
 */
export async function removeContact(contactId: number, userId: string): Promise<boolean> {
  const result = await db.delete(contacts).where(and(
    eq(contacts.id, contactId),
    or(eq(contacts.requester_id, userId), eq(contacts.recipient_id, userId)),
  ));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if two users are accepted contacts
 */
export async function areContacts(userA: string, userB: string): Promise<boolean> {
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.status, "accepted"),
      or(
        and(eq(contacts.requester_id, userA), eq(contacts.recipient_id, userB)),
        and(eq(contacts.requester_id, userB), eq(contacts.recipient_id, userA)),
      ),
    ),
    columns: { id: true },
  });
  return !!contact;
}
