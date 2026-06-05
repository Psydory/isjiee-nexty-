// backend/services/notifications.js

import { nanoid } from 'nanoid';

/**
 * Types officiels notifications
 */
export const NOTIFICATION_TYPES = {

  reward: 'reward',

  level_up: 'level_up',

  achievement: 'achievement',

  certificate: 'certificate',

  payout: 'payout',

  moderation: 'moderation',

  system: 'system'
};

/**
 * Créer notification
 */
export async function createNotification(
  db,
  {
    userId,
    type,
    message,
    expiresInDays = null
  }
) {

  if (!userId) {
    throw new Error('userId requis');
  }

  if (!message) {
    throw new Error('message requis');
  }

  if (
    !Object.values(NOTIFICATION_TYPES)
      .includes(type)
  ) {
    throw new Error('type notification invalide');
  }

  const now = Date.now();

  let expiresAt = null;

  // =========================
  // EXPIRATION
  // =========================
  if (expiresInDays) {

    expiresAt =
      now +
      (
        expiresInDays *
        24 *
        60 *
        60 *
        1000
      );
  }

  const id = nanoid();

  await db.prepare(`
    INSERT INTO notifications (
      id,
      user_id,
      type,
      message,
      read,
      expires_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  .bind(
    id,
    userId,
    type,
    message,
    0,
    expiresAt,
    now
  )
  .run();

  return {
    success: true,
    id
  };
}

/**
 * Notifications utilisateur
 */
export async function getUserNotifications(
  db,
  userId,
  limit = 20
) {

  return await db.prepare(`
    SELECT *
    FROM notifications
    WHERE user_id = ?
    AND (
      expires_at IS NULL
      OR expires_at > ?
    )
    ORDER BY created_at DESC
    LIMIT ?
  `)
  .bind(
    userId,
    Date.now(),
    limit
  )
  .all();
}

/**
 * Marquer comme lu
 */
export async function markAsRead(
  db,
  notificationId,
  userId
) {

  await db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE id = ?
    AND user_id = ?
  `)
  .bind(
    notificationId,
    userId
  )
  .run();

  return {
    success: true
  };
}

/**
 * Marquer toutes comme lues
 */
export async function markAllAsRead(
  db,
  userId
) {

  await db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE user_id = ?
  `)
  .bind(userId)
  .run();

  return {
    success: true
  };
}

/**
 * Supprimer notifications expirées
 */
export async function cleanupExpiredNotifications(
  db
) {

  const result = await db.prepare(`
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
    AND expires_at <= ?
  `)
  .bind(Date.now())
  .run();

  return {
    success: true,
    deleted: result.meta.changes || 0
  };
}

/**
 * Notification level up
 */
export async function sendLevelUpNotification(
  db,
  userId,
  level
) {

  return await createNotification(
    db,
    {
      userId,
      type: 'level_up',
      message:
        `Congratulations! ` +
        `You reached ${level} entrepreneur level.`,
      expiresInDays: 30
    }
  );
}

/**
 * Notification achievement
 */
export async function sendAchievementNotification(
  db,
  userId,
  achievementTitle
) {

  return await createNotification(
    db,
    {
      userId,
      type: 'achievement',
      message:
        `Achievement unlocked: ${achievementTitle}`,
      expiresInDays: 30
    }
  );
}