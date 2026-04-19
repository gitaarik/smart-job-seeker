import { dbDirect as db } from "$lib/server/db";
import { eq, and, isNull, count, desc } from "drizzle-orm";
import { notifications } from "$lib/server/db/schema";

export interface CreateNotification {
  userId: string;
  type: string;
  title: string;
  message?: string;
  link?: string;
}

/**
 * Create a notification for a user.
 */
export async function createNotification(data: CreateNotification) {
  const [result] = await db.insert(notifications).values({
    user_id: data.userId,
    type: data.type,
    title: data.title,
    message: data.message || null,
    link: data.link || null,
  }).returning();
  return result;
}

/**
 * Create notifications for multiple users at once.
 */
export async function createNotifications(notifs: CreateNotification[]) {
  if (notifs.length === 0) return;
  await db.insert(notifications).values(
    notifs.map((n) => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message || null,
      link: n.link || null,
    })),
  );
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(notifications)
    .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
  return value;
}

/**
 * Get recent notifications for a user.
 */
export async function getNotifications(userId: string, limit = 20) {
  return db.query.notifications.findMany({
    where: eq(notifications.user_id, userId),
    orderBy: desc(notifications.created_at),
    limit: limit,
  });
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: number, userId: string) {
  await db.update(notifications).set({ read_at: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.user_id, userId)));
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  await db.update(notifications).set({ read_at: new Date() })
    .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
}
