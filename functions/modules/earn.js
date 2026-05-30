// =========================
// functions/modules/earn.js
// SYSTÈME BAR - VERSION HARMONISÉE
// =========================

import {
  ok,
  badRequest,
  unauthorized,
  tooManyRequests,
  withErrorHandler
} from "../core/errorHandler.js";

import { checkRateLimitD1 } from "../core/rate-limit.js";

// =========================
// SOURCES OFFICIELLES BAR
// =========================

const EARN_RULES = {
  quiz_pass: {
    amount: 20,
    cooldown: 86400000
  },

  task_complete: {
    amount: 10,
    cooldown: 60000
  },

  project_complete: {
    amount: 30,
    cooldown: 300000
  },

  referral: {
    amount: 25,
    cooldown: 3600000
  },

  certificate_reward: {
    amount: 50,
    cooldown: 86400000
  },

  daily_login: {
    amount: 1,
    cooldown: 86400000
  }
};

const MAX_DAILY_POINTS = 500;

// =========================
// COOLDOWN
// =========================

async function checkCooldown(env, userId, source, cooldown) {

  const since = Date.now() - cooldown;

  const existing = await env.DB.prepare(`
    SELECT id
    FROM earnings
    WHERE user_id = ?
      AND source = ?
      AND created_at > ?
    LIMIT 1
  `)
  .bind(userId, source, since)
  .first();

  return !existing;
}

// =========================
// AJOUT GAIN
// =========================

async function addEarning(
  env,
  userId,
  source,
  amount,
  meta = null
) {

  const now = Date.now();

  await env.DB.prepare(`
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

  await env.DB.prepare(`
    UPDATE users
    SET balance = COALESCE(balance,0) + ?
    WHERE id = ?
  `)
  .bind(amount, userId)
  .run();

  return {
    source,
    amount,
    created_at: now
  };
}

// =========================
// EARN POINTS
// =========================

export const earn = withErrorHandler(async (
  request,
  env,
  user
) => {

  if (!user) {
    return unauthorized();
  }

  const body = await request.json();

  const source = body?.source;

  if (!source || !EARN_RULES[source]) {
    return badRequest("Invalid source");
  }

  const rule = EARN_RULES[source];

  const ip =
    request.headers.get("cf-connecting-ip")
    || "unknown";

  const rate = await checkRateLimitD1(
    env,
    `earn:${user.id}:${ip}`,
    20,
    60000
  );

  if (!rate.allowed) {
    return tooManyRequests();
  }

  const cooldownOk = await checkCooldown(
    env,
    user.id,
    source,
    rule.cooldown
  );

  if (!cooldownOk) {
    return badRequest(
      "Cooldown active for this reward"
    );
  }

  const today = new Date()
    .setHours(0, 0, 0, 0);

  const daily = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total
    FROM earnings
    WHERE user_id = ?
    AND created_at >= ?
  `)
  .bind(user.id, today)
  .first();

  const currentDaily =
    daily?.total || 0;

  if (
    currentDaily + rule.amount >
    MAX_DAILY_POINTS
  ) {
    return badRequest(
      "Daily limit reached"
    );
  }

  const transaction =
    await addEarning(
      env,
      user.id,
      source,
      rule.amount
    );

  return ok({
    success: true,
    points: transaction.amount,
    source: transaction.source,
    created_at: transaction.created_at
  });
});

// =========================
// HISTORIQUE
// =========================

export const getUserEarnings =
withErrorHandler(async (
  request,
  env,
  user
) => {

  if (!user) {
    return unauthorized();
  }

  const rows =
    await env.DB.prepare(`
      SELECT
        id,
        source,
        amount,
        meta,
        created_at
      FROM earnings
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `)
    .bind(user.id)
    .all();

  return ok({
    earnings: rows.results || []
  });
});

// =========================
// SOLDE
// =========================

export const getUserBalance =
withErrorHandler(async (
  request,
  env,
  user
) => {

  if (!user) {
    return unauthorized();
  }

  const balance =
    await env.DB.prepare(`
      SELECT balance
      FROM users
      WHERE id = ?
    `)
    .bind(user.id)
    .first();

  return ok({
    balance:
      balance?.balance || 0
  });
});

// =========================
// ADMIN STATS
// =========================

export const getEarningsStats =
withErrorHandler(async (
  request,
  env,
  user
) => {

  if (
    !user ||
    user.role !== "admin"
  ) {
    return unauthorized();
  }

  const stats =
    await env.DB.prepare(`
      SELECT
        source,
        COUNT(*) AS count,
        SUM(amount) AS total
      FROM earnings
      GROUP BY source
      ORDER BY total DESC
    `)
    .all();

  const overview =
    await env.DB.prepare(`
      SELECT
        COUNT(*) AS transactions,
        SUM(amount) AS total_points
      FROM earnings
    `)
    .first();

  return ok({
    overview,
    stats: stats.results || []
  });
});