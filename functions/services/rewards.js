// backend/services/rewards.js

import { awardPoints } from './entrepreneur.js';

/**
 * Récompenses BAR officielles
 */
export const REWARDS = {

  quiz_completed: {
    points: 100,
    cooldownHours: 1
  },

  task_completed: {
    points: 250,
    cooldownHours: 0
  },

  media_upload: {
    points: 25,
    cooldownHours: 2
  },

  certificate_earned: {
    points: 500,
    cooldownHours: 0
  },

  daily_login: {
    points: 15,
    cooldownHours: 24
  },

  referral_signup: {
    points: 300,
    cooldownHours: 0
  }
};

/**
 * Vérifie cooldown anti-spam
 */
async function checkCooldown(
  db,
  userId,
  source,
  cooldownHours
) {

  if (!cooldownHours) {
    return true;
  }

  const limit =
    Date.now() -
    (cooldownHours * 60 * 60 * 1000);

  const recent = await db.prepare(`
    SELECT id
    FROM earnings
    WHERE user_id = ?
    AND source = ?
    AND created_at >= ?
    LIMIT 1
  `)
  .bind(
    userId,
    source,
    limit
  )
  .first();

  return !recent;
}

/**
 * Appliquer multiplicateur niveau entrepreneur
 */
function applyMultiplier(points, level) {

  const multipliers = {
    green: 1,
    silver: 1.2,
    gold: 1.5,
    diamond: 2,
    crystal: 3
  };

  return Math.floor(
    points * (multipliers[level] || 1)
  );
}

/**
 * Donner récompense BAR
 */
export async function rewardUser(
  db,
  {
    userId,
    rewardKey,
    meta = null
  }
) {

  if (!userId) {
    throw new Error('userId requis');
  }

  if (!REWARDS[rewardKey]) {
    throw new Error('rewardKey invalide');
  }

  const reward =
    REWARDS[rewardKey];

  // =========================
  // CHECK COOLDOWN
  // =========================
  const allowed = await checkCooldown(
    db,
    userId,
    rewardKey,
    reward.cooldownHours
  );

  if (!allowed) {

    return {
      success: false,
      reason: 'cooldown_active'
    };
  }

  // =========================
  // GET USER LEVEL
  // =========================
  const progression = await db.prepare(`
    SELECT current_level
    FROM entrepreneur_progression
    WHERE user_id = ?
  `)
  .bind(userId)
  .first();

  const level =
    progression?.current_level || 'green';

  // =========================
  // APPLY MULTIPLIER
  // =========================
  const finalPoints =
    applyMultiplier(
      reward.points,
      level
    );

  // =========================
  // AWARD POINTS
  // =========================
  await awardPoints(
    db,
    {
      userId,
      amount: finalPoints,
      source: rewardKey,
      meta
    }
  );

  return {
    success: true,
    rewardKey,
    basePoints: reward.points,
    finalPoints,
    level
  };
}

/**
 * Vérifie récompenses spéciales
 */
export async function checkSpecialRewards(
  db,
  userId
) {

  const progression = await db.prepare(`
    SELECT *
    FROM entrepreneur_progression
    WHERE user_id = ?
  `)
  .bind(userId)
  .first();

  if (!progression) {
    return;
  }

  // =========================
  // BONUS 10K POINTS
  // =========================
  if (
    progression.total_points >= 10000
  ) {

    const already = await db.prepare(`
      SELECT id
      FROM earnings
      WHERE user_id = ?
      AND source = 'bonus_10k'
      LIMIT 1
    `)
    .bind(userId)
    .first();

    if (!already) {

      await awardPoints(
        db,
        {
          userId,
          amount: 1000,
          source: 'bonus_10k',
          meta: {
            milestone: 10000
          }
        }
      );
    }
  }
}