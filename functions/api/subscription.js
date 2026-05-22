// functions/modules/subscription.js
// Abonnements – version production (avec Stripe webhook mock, durées par plan, transactions)

import { ok, badRequest, unauthorized, forbidden, withErrorHandler } from "../core/errorHandler.js";
import { checkRateLimitD1 } from "../core/rate-limit.js";

// =========================
// CONFIGURATION
// =========================
const TRIAL_DAYS = 14;

const PLAN_DURATIONS = {
  premium_monthly: 30,
  premium_yearly: 365,
  business: 365
};
const PLANS_WHITELIST = Object.keys(PLAN_DURATIONS);

const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  PAYMENT_FAILED: 'payment_failed'
};

// =========================
// HELPERS
// =========================
function getPlanDuration(planId) {
  return PLAN_DURATIONS[planId] || 30;
}

// Simulation d’un appel à Stripe (à remplacer par un vrai webhook)
async function processPayment(env, userId, planId) {
  // Ici, vous appelleriez Stripe, LemonSqueezy, etc.
  // Pour l’exemple, on simule un succès (à remplacer par une vraie validation)
  console.log(`[PAYMENT] User ${userId} subscribed to ${planId}`);
  return { success: true };
}

// =========================
// OBTENIR LE STATUT (avec gestion des expirations)
// =========================
export const getSubscriptionStatus = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  let subscription = await env.DB.prepare(`
    SELECT id, user_id, status, trial_ends, current_period_start, current_period_end,
           cancel_at_period_end, plan_id, created_at, updated_at
    FROM subscriptions WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(user.id).first();

  if (!subscription) {
    const now = Date.now();
    const trialEnds = now + TRIAL_DAYS * 86400000;
    await env.DB.prepare(`
      INSERT INTO subscriptions (user_id, status, trial_ends, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(user.id, SUBSCRIPTION_STATUSES.TRIAL, trialEnds, now, trialEnds, now, now).run();
    subscription = await env.DB.prepare(`SELECT * FROM subscriptions WHERE user_id = ?`).bind(user.id).first();
  }

  const now = Date.now();
  const trialEnds = subscription?.trial_ends || 0;
  const trialDaysLeft = trialEnds > now ? Math.ceil((trialEnds - now) / 86400000) : 0;

  // Mise à jour des abonnements expirés (actifs ou en trial)
  if (subscription.status === SUBSCRIPTION_STATUSES.ACTIVE && subscription.current_period_end < now) {
    await env.DB.prepare(`UPDATE subscriptions SET status = ? WHERE id = ?`)
      .bind(SUBSCRIPTION_STATUSES.EXPIRED, subscription.id).run();
    subscription.status = SUBSCRIPTION_STATUSES.EXPIRED;
  }
  if (subscription.status === SUBSCRIPTION_STATUSES.TRIAL && trialEnds < now) {
    await env.DB.prepare(`UPDATE subscriptions SET status = ? WHERE id = ?`)
      .bind(SUBSCRIPTION_STATUSES.EXPIRED, subscription.id).run();
    subscription.status = SUBSCRIPTION_STATUSES.EXPIRED;
  }

  const isActive = subscription.status === SUBSCRIPTION_STATUSES.ACTIVE &&
                   (subscription.current_period_end || 0) > now;

  return ok({
    status: subscription.status,
    isActive,
    isTrial: subscription.status === SUBSCRIPTION_STATUSES.TRIAL && trialDaysLeft > 0,
    trialDaysLeft: Math.max(0, trialDaysLeft),
    trialEndsAt: trialEnds,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === 1,
    planId: subscription.plan_id || 'free'
  });
});

// =========================
// RENOUVELLEMENT (avec transaction et appel de paiement)
// =========================
export const renewSubscription = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  // Rate limiting (5 renouvellements par heure)
  const rateKey = `renew:${user.id}`;
  const allowed = await checkRateLimitD1(env, rateKey, 5, 3600000);
  if (!allowed.allowed) return forbidden("Too many renewal attempts. Try later.");

  const { planId = 'premium_monthly' } = await request.json();
  if (!PLANS_WHITELIST.includes(planId)) return badRequest('Invalid plan ID');

  // Vérifier le paiement réel (appel à Stripe/autre)
  const paymentOk = await processPayment(env, user.id, planId);
  if (!paymentOk) return badRequest('Payment failed');

  const now = Date.now();
  const duration = getPlanDuration(planId);
  const periodEnd = now + duration * 86400000;

  await env.DB.prepare('BEGIN TRANSACTION').run();
  try {
    const existing = await env.DB.prepare(`SELECT id, current_period_end FROM subscriptions WHERE user_id = ?`).bind(user.id).first();
    if (existing) {
      const newPeriodEnd = (existing.current_period_end && existing.current_period_end > now)
        ? existing.current_period_end + duration * 86400000
        : periodEnd;
      await env.DB.prepare(`
        UPDATE subscriptions
        SET status = ?, current_period_start = ?, current_period_end = ?,
            plan_id = ?, trial_ends = NULL, cancel_at_period_end = 0, updated_at = ?
        WHERE id = ?
      `).bind(SUBSCRIPTION_STATUSES.ACTIVE, now, newPeriodEnd, planId, now, existing.id).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO subscriptions (user_id, status, current_period_start, current_period_end, plan_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(user.id, SUBSCRIPTION_STATUSES.ACTIVE, now, periodEnd, planId, now, now).run();
    }
    await env.DB.prepare('COMMIT').run();
  } catch (err) {
    await env.DB.prepare('ROLLBACK').run();
    throw err;
  }

  return ok({
    message: 'Subscription renewed successfully',
    plan: planId,
    expiresAt: periodEnd
  });
});

// =========================
// ANNULATION (fin de période)
// =========================
export const cancelSubscription = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const rateKey = `cancel:${user.id}`;
  const allowed = await checkRateLimitD1(env, rateKey, 3, 3600000);
  if (!allowed.allowed) return forbidden("Too many cancellation attempts");

  const subscription = await env.DB.prepare(`SELECT id FROM subscriptions WHERE user_id = ?`).bind(user.id).first();
  if (!subscription) return badRequest('No active subscription found');

  await env.DB.prepare(`UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE id = ?`)
    .bind(Date.now(), subscription.id).run();

  return ok({ message: 'Subscription will be cancelled at the end of the current period' });
});

// =========================
// RÉACTIVATION
// =========================
export const reactivateSubscription = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const subscription = await env.DB.prepare(`SELECT id FROM subscriptions WHERE user_id = ?`).bind(user.id).first();
  if (!subscription) return badRequest('No subscription found');

  await env.DB.prepare(`UPDATE subscriptions SET cancel_at_period_end = 0, updated_at = ? WHERE id = ?`)
    .bind(Date.now(), subscription.id).run();

  return ok({ message: 'Subscription reactivated' });
});

// =========================
// ADMIN : LISTE DES ABONNEMENTS (avec pagination)
// =========================
export const getAllSubscriptions = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== 'admin') return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit')) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get('offset')) || 0);
  const status = url.searchParams.get('status');

  let query = `
    SELECT s.*,
      CASE
        WHEN u.role = 'admin' THEN u.email
        ELSE SUBSTR(u.email, 1, 2) || '***' || SUBSTR(u.email, INSTR(u.email, '@') - 1)
      END as user_email
    FROM subscriptions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE 1=1
  `;
  const params = [];

  if (status && Object.values(SUBSCRIPTION_STATUSES).includes(status)) {
    query += ` AND s.status = ?`;
    params.push(status);
  }
  query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const subscriptions = await env.DB.prepare(query).bind(...params).all();

  let countQuery = `SELECT COUNT(*) as total FROM subscriptions WHERE 1=1`;
  const countParams = [];
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  const total = await env.DB.prepare(countQuery).bind(...countParams).first();

  return ok({
    subscriptions: subscriptions.results || [],
    pagination: {
      limit,
      offset,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  });
});

// =========================
// ADMIN : STATISTIQUES
// =========================
export const getSubscriptionStats = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== 'admin') return unauthorized();

  const stats = await env.DB.prepare(`
    SELECT
      COUNT(CASE WHEN status = ? THEN 1 END) as active,
      COUNT(CASE WHEN status = ? THEN 1 END) as trial,
      COUNT(CASE WHEN status = ? THEN 1 END) as cancelled,
      COUNT(CASE WHEN status = ? THEN 1 END) as expired,
      COUNT(CASE WHEN status = ? THEN 1 END) as payment_failed,
      COUNT(*) as total
    FROM subscriptions
  `).bind(
    SUBSCRIPTION_STATUSES.ACTIVE, SUBSCRIPTION_STATUSES.TRIAL,
    SUBSCRIPTION_STATUSES.CANCELLED, SUBSCRIPTION_STATUSES.EXPIRED,
    SUBSCRIPTION_STATUSES.PAYMENT_FAILED
  ).first();

  return ok({ stats });
});

// =========================
// ADMIN : NETTOYAGE (expire les anciens abonnements)
// =========================
export const cleanupExpiredSubscriptions = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== 'admin') return unauthorized();

  const now = Date.now();
  // Expirer les abonnements actifs dont la période est terminée
  await env.DB.prepare(`
    UPDATE subscriptions
    SET status = ?, updated_at = ?
    WHERE status = ? AND current_period_end < ?
  `).bind(SUBSCRIPTION_STATUSES.EXPIRED, now, SUBSCRIPTION_STATUSES.ACTIVE, now).run();

  // Expirer les trials dépassés
  await env.DB.prepare(`
    UPDATE subscriptions
    SET status = ?, updated_at = ?
    WHERE status = ? AND trial_ends < ?
  `).bind(SUBSCRIPTION_STATUSES.EXPIRED, now, SUBSCRIPTION_STATUSES.TRIAL, now).run();

  // (Optionnel) Marquer les cancellations anciennes si besoin
  return ok({ message: 'Cleanup executed' });
});