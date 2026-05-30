// backend/services/entrepreneur.js

import { nanoid } from 'nanoid';

/**
 * Configuration des niveaux entrepreneur
 */
const LEVELS = [
  { key: 'green', min: 0, multiplier: 1 },
  { key: 'silver', min: 1000, multiplier: 1.2 },
  { key: 'gold', min: 5000, multiplier: 1.5 },
  { key: 'diamond', min: 20000, multiplier: 2 },
  { key: 'crystal', min: 100000, multiplier: 3 }
];

/**
 * Déterminer le niveau selon les points
 */
export function calculateLevel(points = 0) {
  let current = LEVELS[0];

  for (const level of LEVELS) {
    if (points >= level.min) {
      current = level;
    }
  }

  return current;
}

/**
 * Ajouter des points entrepreneur
 */
export async function awardPoints(db, {
  userId,
  amount,
  source,
  meta = null
}) {

  if (!userId) {
    throw new Error('userId requis');
  }

  if (!amount || amount <= 0) {
    throw new Error('amount invalide');
  }

  const now = Date.now();

  // =========================
  // INSERT EARNINGS
  // =========================
  await db.prepare(`
    INSERT INTO earnings (
      user_id,
      source,
      amount,
      meta,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `)
  .bind(
    userId,
    source,
    amount,
    meta ? JSON.stringify(meta) : null,
    now
  )
  .run();

  // =========================
  // GET PROGRESSION
  // =========================
  const progression = await db.prepare(`
    SELECT *
    FROM entrepreneur_progression
    WHERE user_id = ?
  `)
  .bind(userId)
  .first();

  if (!progression) {

    await db.prepare(`
      INSERT INTO entrepreneur_progression (
        user_id,
        total_points,
        lifetime_points,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      userId,
      amount,
      amount,
      now,
      now
    )
    .run();

  } else {

    const totalPoints =
      progression.total_points + amount;

    const lifetimePoints =
      progression.lifetime_points + amount;

    const level =
      calculateLevel(totalPoints);

    await db.prepare(`
      UPDATE entrepreneur_progression
      SET
        total_points = ?,
        lifetime_points = ?,
        current_level = ?,
        updated_at = ?
      WHERE user_id = ?
    `)
    .bind(
      totalPoints,
      lifetimePoints,
      level.key,
      now,
      userId
    )
    .run();
  }

  // =========================
  // UPDATE LEADERBOARD
  // =========================
  await updateLeaderboard(db, userId);

  // =========================
  // CHECK ACHIEVEMENTS
  // =========================
  await checkAchievements(db, userId);

  return {
    success: true,
    points: amount
  };
}

/**
 * Synchroniser leaderboard
 */
export async function updateLeaderboard(db, userId) {

  const user = await db.prepare(`
    SELECT
      ep.total_points,
      ep.current_level,
      ep.completed_tasks,
      ep.certificates_count,
      (
        SELECT COUNT(*)
        FROM media_views mv
        JOIN media m
        ON mv.media_id = m.id
        WHERE m.user_id = ?
      ) AS media_views
    FROM entrepreneur_progression ep
    WHERE ep.user_id = ?
  `)
  .bind(userId, userId)
  .first();

  if (!user) return;

  const score =
    user.total_points +
    (user.completed_tasks * 10) +
    (user.certificates_count * 50);

  const now = Date.now();

  await db.prepare(`
    INSERT INTO leaderboard (
      user_id,
      total_points,
      level_key,
      completed_tasks,
      certificates_count,
      media_views,
      score,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(user_id)
    DO UPDATE SET
      total_points = excluded.total_points,
      level_key = excluded.level_key,
      completed_tasks = excluded.completed_tasks,
      certificates_count = excluded.certificates_count,
      media_views = excluded.media_views,
      score = excluded.score,
      updated_at = excluded.updated_at
  `)
  .bind(
    userId,
    user.total_points,
    user.current_level,
    user.completed_tasks,
    user.certificates_count,
    user.media_views,
    score,
    now,
    now
  )
  .run();
}

/**
 * Vérification achievements
 */
export async function checkAchievements(db, userId) {

  const progression = await db.prepare(`
    SELECT *
    FROM entrepreneur_progression
    WHERE user_id = ?
  `)
  .bind(userId)
  .first();

  if (!progression) return;

  const achievements = [];

  if (progression.total_points >= 1000) {
    achievements.push({
      key: '1000_points',
      title: '1000 Points Reached',
      rarity: 'rare'
    });
  }

  if (progression.current_level === 'gold') {
    achievements.push({
      key: 'gold_entrepreneur',
      title: 'Gold Entrepreneur',
      rarity: 'epic'
    });
  }

  for (const achievement of achievements) {

    const exists = await db.prepare(`
      SELECT id
      FROM achievements
      WHERE user_id = ?
      AND achievement_key = ?
    `)
    .bind(userId, achievement.key)
    .first();

    if (exists) continue;

    await db.prepare(`
      INSERT INTO achievements (
        id,
        user_id,
        achievement_key,
        title,
        rarity,
        unlocked_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      nanoid(),
      userId,
      achievement.key,
      achievement.title,
      achievement.rarity,
      Date.now(),
      Date.now()
    )
    .run();
  }
}