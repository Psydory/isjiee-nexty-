// backend/services/leaderboard.js

/**
 * Calcul officiel score leaderboard
 */
export function calculateScore({
  totalPoints = 0,
  completedTasks = 0,
  certificates = 0,
  mediaViews = 0,
  achievements = 0
}) {

  return (
    totalPoints +

    (completedTasks * 25) +

    (certificates * 100) +

    Math.floor(mediaViews / 10) +

    (achievements * 150)
  );
}

/**
 * Synchroniser leaderboard utilisateur
 */
export async function syncLeaderboard(
  db,
  userId
) {

  if (!userId) {
    throw new Error('userId requis');
  }

  // =========================
  // PROGRESSION
  // =========================
  const progression =
    await db.prepare(`
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
  // CERTIFICATES
  // =========================
  const certificates =
    await db.prepare(`
      SELECT COUNT(*) as total
      FROM certificates
      WHERE user_id = ?
    `)
    .bind(userId)
    .first();

  // =========================
  // ACHIEVEMENTS
  // =========================
  const achievements =
    await db.prepare(`
      SELECT COUNT(*) as total
      FROM achievements
      WHERE user_id = ?
    `)
    .bind(userId)
    .first();

  // =========================
  // MEDIA VIEWS
  // =========================
  const mediaViews =
    await db.prepare(`
      SELECT COUNT(*) as total
      FROM media_views mv
      JOIN media m
      ON mv.media_id = m.id
      WHERE m.user_id = ?
    `)
    .bind(userId)
    .first();

  // =========================
  // SCORE
  // =========================
  const score =
    calculateScore({

      totalPoints:
        progression.total_points,

      completedTasks:
        progression.completed_tasks,

      certificates:
        certificates?.total || 0,

      mediaViews:
        mediaViews?.total || 0,

      achievements:
        achievements?.total || 0
    });

  const now = Date.now();

  // =========================
  // UPSERT LEADERBOARD
  // =========================
  await db.prepare(`
    INSERT INTO leaderboard (
      user_id,
      total_points,
      completed_tasks,
      certificates_count,
      media_views,
      achievements_count,
      current_level,
      score,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(user_id)
    DO UPDATE SET

      total_points =
        excluded.total_points,

      completed_tasks =
        excluded.completed_tasks,

      certificates_count =
        excluded.certificates_count,

      media_views =
        excluded.media_views,

      achievements_count =
        excluded.achievements_count,

      current_level =
        excluded.current_level,

      score =
        excluded.score,

      updated_at =
        excluded.updated_at
  `)
  .bind(
    userId,

    progression.total_points,

    progression.completed_tasks,

    certificates?.total || 0,

    mediaViews?.total || 0,

    achievements?.total || 0,

    progression.current_level,

    score,

    now,

    now
  )
  .run();

  return {
    success: true,
    score
  };
}

/**
 * Top leaderboard global
 */
export async function getTopLeaderboard(
  db,
  limit = 50
) {

  return await db.prepare(`
    SELECT
      l.*,
      u.email
    FROM leaderboard l

    LEFT JOIN users u
    ON l.user_id = u.id

    ORDER BY score DESC

    LIMIT ?
  `)
  .bind(limit)
  .all();
}

/**
 * Position utilisateur
 */
export async function getUserRank(
  db,
  userId
) {

  const leaderboard =
    await db.prepare(`
      SELECT
        user_id,
        score
      FROM leaderboard
      ORDER BY score DESC
    `)
    .all();

  const rows =
    leaderboard.results || [];

  const rank =
    rows.findIndex(
      row => row.user_id === userId
    );

  if (rank === -1) {

    return {
      rank: null
    };
  }

  return {
    rank: rank + 1,
    total: rows.length
  };
}