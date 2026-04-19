/**
 * Contacts service — manage user-to-user contact relationships
 */

import { db } from "$lib/server/db";
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
      where: { requester_id: userId, status: { in: ["pending", "accepted"] } },
      select: {
        id: true,
        status: true,
        date_created: true,
        recipient: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { date_created: "desc" },
    }),
    db.query.contacts.findMany({
      where: { recipient_id: userId, status: { in: ["pending", "accepted"] } },
      select: {
        id: true,
        status: true,
        date_created: true,
        requester: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { date_created: "desc" },
    }),
  ]);

  return [
    ...sent.map((c) => ({
      id: c.id,
      status: c.status,
      date_created: c.date_created,
      user: c.recipient,
      direction: "sent" as const,
    })),
    ...received.map((c) => ({
      id: c.id,
      status: c.status,
      date_created: c.date_created,
      user: c.requester,
      direction: "received" as const,
    })),
  ];
}

/**
 * List only accepted contacts for a user (for sharing UI)
 */
export async function listAcceptedContacts(userId: string) {
  const contacts = await listContacts(userId);
  return contacts.filter((c) => c.status === "accepted");
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
    where: { email: recipientEmail },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!recipient) {
    return { success: false, error: "No user found with that email address" };
  }

  if (recipient.id === requesterId) {
    return { success: false, error: "You cannot add yourself as a contact" };
  }

  // Check if contact already exists (in either direction)
  const existing = await db.query.contacts.findFirst({
    where: {
      OR: [
        { requester_id: requesterId, recipient_id: recipient.id },
        { requester_id: recipient.id, recipient_id: requesterId },
      ],
    },
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
      await db.contacts.update({
        where: { id: existing.id },
        data: {
          requester_id: requesterId,
          recipient_id: recipient.id,
          status: "pending",
          date_updated: new Date(),
        },
      });
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

  const created = await db.contacts.create({
    data: {
      requester_id: requesterId,
      recipient_id: recipient.id,
    },
    select: { id: true, date_created: true },
  });

  // Notify the recipient
  const requester = await db.query.users.findFirst({
    where: { id: requesterId },
    select: { name: true, email: true },
  });
  const requesterName = requester?.name || requester?.email || "Someone";
  await createNotification({
    userId: recipient.id,
    type: "contact_request",
    title: `${requesterName} sent you a contact request`,
    link: "/dashboard/contacts",
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
  const result = await db.contacts.updateMany({
    where: {
      id: contactId,
      recipient_id: userId,
      status: "pending",
    },
    data: {
      status: "accepted",
      date_updated: new Date(),
    },
  });
  return result.count > 0;
}

/**
 * Decline a contact request (only the recipient can decline)
 */
export async function declineContact(contactId: number, userId: string): Promise<boolean> {
  const result = await db.contacts.updateMany({
    where: {
      id: contactId,
      recipient_id: userId,
      status: "pending",
    },
    data: {
      status: "declined",
      date_updated: new Date(),
    },
  });
  return result.count > 0;
}

/**
 * Remove a contact (either user can remove)
 */
export async function removeContact(contactId: number, userId: string): Promise<boolean> {
  const result = await db.contacts.deleteMany({
    where: {
      id: contactId,
      OR: [{ requester_id: userId }, { recipient_id: userId }],
    },
  });
  return result.count > 0;
}

/**
 * Check if two users are accepted contacts
 */
export async function areContacts(userA: string, userB: string): Promise<boolean> {
  const contact = await db.query.contacts.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requester_id: userA, recipient_id: userB },
        { requester_id: userB, recipient_id: userA },
      ],
    },
    select: { id: true },
  });
  return !!contact;
}
