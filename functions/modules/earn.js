// =========================
// functions/modules/earn.js
// VERSION FINALE CORRIGÉE
// =========================

import { ok, badRequest, unauthorized, tooManyRequests, withErrorHandler } from "../core/errorHandler.js";
import { checkRateLimitD1 } from "../core/rate-limit.js";

const EARN_RULES = {
  referral: { amount: 5, cooldown: 3600000 },    // 1 heure
  content: { amount: 3, cooldown: 300000 },      // 5 minutes
  premium: { amount: 10, cooldown: 86400000 },   // 24 heures
  daily_login: { amount: 1, cooldown: 86400000 },
  task_complete: { amount: 2, cooldown: 60000 }
};

const MAX_DAILY_EARNINGS = 100;

// =========================
// VÉRIFIER COOLDOWN AVEC D1
// =========================
async function checkCooldown(env, userId, source, cooldownMs) {
  const windowStart = Date.now() - cooldownMs;
  const lastAction = await env.DB.prepare(`
    SELECT created_at FROM earnings 
    WHERE user_id = ? AND source = ? AND created_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(userId, source, windowStart).first();
  return !lastAction;
}

// =========================
// AJOUTER UN GAIN (AVEC TRANSACTION)
// =========================
async function addEarning(env, userId, source, amount) {
  if (amount <= 0) throw new Error("Amount must be positive");
  
  const now = Date.now();
  
  await env.DB.prepare("BEGIN TRANSACTION").run();
  try {
    await env.DB.prepare(`
      INSERT INTO earnings (user_id, source, amount, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(userId, source, amount, now).run();
    
    await env.DB.prepare(`
      UPDATE users SET balance = balance + ? WHERE id = ?
    `).bind(amount, userId).run();
    
    await env.DB.prepare("COMMIT").run();
  } catch (err) {
    await env.DB.prepare("ROLLBACK").run();
    throw err;
  }
  
  return { userId, source, amount, createdAt: now };
}

// =========================
// OBTENIR LES GAINS (champs limités)
// =========================
export const getUserEarnings = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();
  
  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);
  
  const earnings = await env.DB.prepare(`
    SELECT id, source, amount, created_at FROM earnings 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).bind(user.id, limit, offset).all();
  
  const total = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM earnings WHERE user_id = ?
  `).bind(user.id).first();
  
  return ok({
    earnings: earnings.results || [],
    pagination: { limit, offset, total: total?.total || 0 }
  });
});

// =========================
// OBTENIR LE SOLDE
// =========================
export const getUserBalance = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();
  
  const balance = await env.DB.prepare(`
    SELECT balance FROM users WHERE id = ?
  `).bind(user.id).first();
  
  return ok({ balance: balance?.balance || 0 });
});

// =========================
// GÉNÉRER UN GAIN
// =========================
export const earn = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();
  
  const { source } = await request.json();
  
  if (!source || !EARN_RULES[source]) {
    return badRequest("Invalid earn source");
  }
  
  const rule = EARN_RULES[source];
  
  // Rate limiting global
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rateKey = `earn:${ip}:${user.id}`;
  const rateAllowed = await checkRateLimitD1(env, rateKey, 20, 60000);
  if (!rateAllowed.allowed) return tooManyRequests();
  
  // Vérifier cooldown
  const cooldownOk = await checkCooldown(env, user.id, source, rule.cooldown);
  if (!cooldownOk) {
    return badRequest(`You can earn from ${source} only once every ${rule.cooldown / 1000} seconds`);
  }
  
  // Vérifier limite quotidienne globale
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const dailyTotal = await env.DB.prepare(`
    SELECT SUM(amount) as total FROM earnings 
    WHERE user_id = ? AND created_at > ?
  `).bind(user.id, todayStart).first();
  
  if ((dailyTotal?.total || 0) + rule.amount > MAX_DAILY_EARNINGS) {
    return badRequest(`Daily earning limit reached (max ${MAX_DAILY_EARNINGS} points per day)`);
  }
  
  // Ajouter le gain
  const transaction = await addEarning(env, user.id, source, rule.amount);
  
  console.log(`[EARN] User ${user.id} earned ${rule.amount} from ${source}`);
  
  return ok({
    success: true,
    message: `You earned ${rule.amount} points!`,
    transaction: {
      source: transaction.source,
      amount: transaction.amount,
      created_at: transaction.createdAt
    }
  });
});

// =========================
// STATS ADMIN (avec pagination)
// =========================
export const getEarningsStats = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== "admin") return unauthorized();
  
  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);
  
  const stats = await env.DB.prepare(`
    SELECT source, COUNT(*) as count, SUM(amount) as total
    FROM earnings
    GROUP BY source
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();
  
  const totalEarned = await env.DB.prepare(`
    SELECT SUM(amount) as total FROM earnings
  `).first();
  
  return ok({
    stats: stats.results || [],
    totalEarned: totalEarned?.total || 0,
    pagination: { limit, offset }
  });
});
