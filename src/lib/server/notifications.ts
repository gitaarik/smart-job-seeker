import { dbDirect as db } from "$lib/server/db";

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
  return db.notifications.create({
    data: {
      user_id: data.userId,
      type: data.type,
      title: data.title,
      message: data.message || null,
      link: data.link || null,
    },
  });
}

/**
 * Create notifications for multiple users at once.
 */
export async function createNotifications(notifications: CreateNotification[]) {
  if (notifications.length === 0) return;
  return db.notifications.createMany({
    data: notifications.map((n) => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message || null,
      link: n.link || null,
    })),
  });
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return db.notifications.count({
    where: { user_id: userId, read_at: null },
  });
}

/**
 * Get recent notifications for a user.
 */
export async function getNotifications(userId: string, limit = 20) {
  return db.notifications.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: number, userId: string) {
  return db.notifications.updateMany({
    where: { id: notificationId, user_id: userId },
    data: { read_at: new Date() },
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  return db.notifications.updateMany({
    where: { user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });
}
