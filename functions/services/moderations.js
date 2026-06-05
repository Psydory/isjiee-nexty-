// backend/services/moderation.js

import {
  createNotification
}
from './notifications.js';

/**
 * Statuts officiels médias
 */
export const MEDIA_STATUS = {

  pending: 'pending',

  approved: 'approved',

  rejected: 'rejected'
};

/**
 * Vérifier admin/moderator
 */
function ensureModerator(role) {

  const allowed = [
    'moderator',
    'admin'
  ];

  if (!allowed.includes(role)) {

    throw new Error(
      'permission refusée'
    );
  }
}

/**
 * Approve média
 */
export async function approveMedia(
  db,
  {
    mediaId,
    moderatorId,
    moderatorRole
  }
) {

  ensureModerator(moderatorRole);

  const now = Date.now();

  // =========================
  // UPDATE MEDIA
  // =========================
  await db.prepare(`
    UPDATE media
    SET
      status = 'approved',

      moderated_at = ?,

      moderated_by = ?,

      updated_at = ?

    WHERE id = ?
  `)
  .bind(
    now,
    moderatorId,
    now,
    mediaId
  )
  .run();

  // =========================
  // GET OWNER
  // =========================
  const media =
    await db.prepare(`
      SELECT user_id, title
      FROM media
      WHERE id = ?
    `)
    .bind(mediaId)
    .first();

  // =========================
  // NOTIFICATION
  // =========================
  if (media?.user_id) {

    await createNotification(
      db,
      {
        userId: media.user_id,

        type: 'moderation',

        message:
          `Your media "${media.title}"
           was approved.`,

        expiresInDays: 15
      }
    );
  }

  // =========================
  // ADMIN LOG
  // =========================
  await createAdminLog(
    db,
    {
      adminId: moderatorId,

      action: 'approve_media',

      targetId: mediaId
    }
  );

  return {
    success: true
  };
}

/**
 * Reject média
 */
export async function rejectMedia(
  db,
  {
    mediaId,
    moderatorId,
    moderatorRole,
    reason = null
  }
) {

  ensureModerator(moderatorRole);

  const now = Date.now();

  await db.prepare(`
    UPDATE media
    SET
      status = 'rejected',

      rejection_reason = ?,

      moderated_at = ?,

      moderated_by = ?,

      updated_at = ?

    WHERE id = ?
  `)
  .bind(
    reason,
    now,
    moderatorId,
    now,
    mediaId
  )
  .run();

  const media =
    await db.prepare(`
      SELECT user_id, title
      FROM media
      WHERE id = ?
    `)
    .bind(mediaId)
    .first();

  if (media?.user_id) {

    await createNotification(
      db,
      {
        userId: media.user_id,

        type: 'moderation',

        message:
          `Your media "${media.title}"
           was rejected.`,

        expiresInDays: 15
      }
    );
  }

  await createAdminLog(
    db,
    {
      adminId: moderatorId,

      action: 'reject_media',

      targetId: mediaId,

      details: reason
    }
  );

  return {
    success: true
  };
}

/**
 * Bannir utilisateur
 */
export async function banUser(
  db,
  {
    targetUserId,
    adminId,
    adminRole,
    reason
  }
) {

  ensureModerator(adminRole);

  const now = Date.now();

  await db.prepare(`
    UPDATE users
    SET
      banned = 1,

      ban_reason = ?,

      banned_at = ?,

      banned_by = ?,

      updated_at = ?

    WHERE id = ?
  `)
  .bind(
    reason,
    now,
    adminId,
    now,
    targetUserId
  )
  .run();

  await createNotification(
    db,
    {
      userId: targetUserId,

      type: 'moderation',

      message:
        `Your account was suspended.`,

      expiresInDays: 30
    }
  );

  await createAdminLog(
    db,
    {
      adminId,

      action: 'ban_user',

      targetId: targetUserId,

      details: reason
    }
  );

  return {
    success: true
  };
}

/**
 * Débannir utilisateur
 */
export async function unbanUser(
  db,
  {
    targetUserId,
    adminId,
    adminRole
  }
) {

  ensureModerator(adminRole);

  const now = Date.now();

  await db.prepare(`
    UPDATE users
    SET
      banned = 0,

      ban_reason = NULL,

      banned_at = NULL,

      banned_by = NULL,

      updated_at = ?

    WHERE id = ?
  `)
  .bind(
    now,
    targetUserId
  )
  .run();

  await createNotification(
    db,
    {
      userId: targetUserId,

      type: 'moderation',

      message:
        `Your account access
         was restored.`,

      expiresInDays: 15
    }
  );

  await createAdminLog(
    db,
    {
      adminId,

      action: 'unban_user',

      targetId: targetUserId
    }
  );

  return {
    success: true
  };
}

/**
 * Admin logs
 */
export async function createAdminLog(
  db,
  {
    adminId,
    action,
    targetId = null,
    details = null
  }
) {

  await db.prepare(`
    INSERT INTO admin_logs (
      admin_id,
      action,
      target_id,
      details,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `)
  .bind(
    adminId,
    action,
    targetId,
    details,
    Date.now()
  )
  .run();
}