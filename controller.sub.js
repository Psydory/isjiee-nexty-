// =========================
// IMPORTS
// =========================
import { success, error } from "../utils.js";

// =========================
// CONFIG
// =========================
const TRIAL_DAYS = 7;
const SUB_DURATION_DAYS = 30;

// =========================
// GET SUBSCRIPTION STATUS
// =========================
export async function getSubscriptionStatus(request, env) {

  try {

    const user = request.user;

    const dbUser = await env.DB.prepare(`
      SELECT subscription, trial_ends, subscription_ends
      FROM users WHERE id = ?
    `)
      .bind(user.id)
      .first();

    if (!dbUser) return error("Utilisateur introuvable", 404);

    const now = Date.now();

    let phase = "trial";

    // =========================
    // CHECK PAID
    // =========================
    if (dbUser.subscription === "paid") {

      if (dbUser.subscription_ends && now < dbUser.subscription_ends) {
        phase = "paid";
      } else {
        phase = "expired";
      }

    } else {
      // trial check
      if (dbUser.trial_ends && now > dbUser.trial_ends) {
        phase = "expired";
      }
    }

    return success({
      phase,
      trialEnds: dbUser.trial_ends,
      subscriptionEnds: dbUser.subscription_ends
    });

  } catch (err) {
    return error("Erreur abonnement");
  }
}

// =========================
// START TRIAL (ON REGISTER)
// =========================
export async function startTrial(env, userId) {

  const now = Date.now();
  const trialEnds = now + (TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(`
    UPDATE users
    SET subscription = 'trial',
        trial_ends = ?
    WHERE id = ?
  `)
    .bind(trialEnds, userId)
    .run();
}

// =========================
// ACTIVATE SUBSCRIPTION
// =========================
export async function activateSubscription(request, env) {

  try {

    const user = request.user;

    const now = Date.now();
    const subEnds = now + (SUB_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await env.DB.prepare(`
      UPDATE users
      SET subscription = 'paid',
          subscription_ends = ?
      WHERE id = ?
    `)
      .bind(subEnds, user.id)
      .run();

    return success({
      message: "Abonnement activé",
      subscriptionEnds: subEnds
    });

  } catch (err) {
    return error("Erreur activation abonnement");
  }
}