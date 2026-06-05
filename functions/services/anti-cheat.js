// backend/services/antiCheat.js

/**
 * Limites officielles système BAR
 */
const LIMITS = {

  maxPointsPerHour: 5000,

  maxRewardsPerMinute: 20,

  maxMediaViewsPerHour: 1000,

  maxUploadsPerHour: 50
};

/**
 * Vérifier spam rewards
 */
export async function detectRewardSpam(
  db,
  userId
) {

  const oneMinuteAgo =
    Date.now() - (60 * 1000);

  const result = await db.prepare(`
    SELECT COUNT(*) as total
    FROM earnings
    WHERE user_id = ?
    AND created_at >= ?
  `)
  .bind(
    userId,
    oneMinuteAgo
  )
  .first();

  const total =
    result?.total || 0;

  return {
    suspicious:
      total >
      LIMITS.maxRewardsPerMinute,

    total
  };
}

/**
 * Vérifier farming points
 */
export async function detectPointFarming(
  db,
  userId
) {

  const oneHourAgo =
    Date.now() - (60 * 60 * 1000);

  const result = await db.prepare(`
    SELECT
      SUM(amount) as total
    FROM earnings
    WHERE user_id = ?
    AND created_at >= ?
  `)
  .bind(
    userId,
    oneHourAgo
  )
  .first();

  const total =
    result?.total || 0;

  return {

    suspicious:
      total >
      LIMITS.maxPointsPerHour,

    total
  };
}

/**
 * Vérifier uploads abusifs
 */
export async function detectUploadSpam(
  db,
  userId
) {

  const oneHourAgo =
    Date.now() - (60 * 60 * 1000);

  const result = await db.prepare(`
    SELECT COUNT(*) as total
    FROM media
    WHERE user_id = ?
    AND created_at >= ?
  `)
  .bind(
    userId,
    oneHourAgo
  )
  .first();

  const total =
    result?.total || 0;

  return {

    suspicious:
      total >
      LIMITS.maxUploadsPerHour,

    total
  };
}

/**
 * Vérifier fake media views
 */
export async function detectViewSpam(
  db,
  mediaId,
  ip
) {

  const oneHourAgo =
    Date.now() - (60 * 60 * 1000);

  const result = await db.prepare(`
    SELECT COUNT(*) as total
    FROM media_views
    WHERE media_id = ?
    AND ip = ?
    AND created_at >= ?
  `)
  .bind(
    mediaId,
    ip,
    oneHourAgo
  )
  .first();

  const total =
    result?.total || 0;

  return {

    suspicious:
      total >
      100,

    total
  };
}

/**
 * Vérifier multi-comptes
 */
export async function detectMultiAccount(
  db,
  ip
) {

  const result = await db.prepare(`
    SELECT COUNT(DISTINCT user_id)
      as total

    FROM api_logs

    WHERE ip = ?
    AND user_id IS NOT NULL
  `)
  .bind(ip)
  .first();

  const total =
    result?.total || 0;

  return {

    suspicious:
      total > 10,

    total
  };
}

/**
 * Vérification globale sécurité
 */
export async function runSecurityChecks(
  db,
  {
    userId,
    mediaId = null,
    ip = null
  }
) {

  const checks = [];

  // =========================
  // REWARDS SPAM
  // =========================
  checks.push(
    await detectRewardSpam(
      db,
      userId
    )
  );

  // =========================
  // POINT FARMING
  // =========================
  checks.push(
    await detectPointFarming(
      db,
      userId
    )
  );

  // =========================
  // UPLOAD SPAM
  // =========================
  checks.push(
    await detectUploadSpam(
      db,
      userId
    )
  );

  // =========================
  // VIEW SPAM
  // =========================
  if (mediaId && ip) {

    checks.push(
      await detectViewSpam(
        db,
        mediaId,
        ip
      )
    );
  }

  // =========================
  // MULTI ACCOUNT
  // =========================
  if (ip) {

    checks.push(
      await detectMultiAccount(
        db,
        ip
      )
    );
  }

  const suspicious =
    checks.some(
      check => check.suspicious
    );

  return {
    suspicious,
    checks
  };
}
