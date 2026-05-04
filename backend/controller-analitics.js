// =========================
// IMPORTS
// =========================
import { success, error } from "../utils.js";

// =========================
// GET ANALYTICS
// =========================
export async function getAnalytics(request, env) {

  try {

    // =========================
    // USERS TOTAL
    // =========================
    const usersRes = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM users
    `).first();

    // =========================
    // PREMIUM USERS
    // =========================
    const premiumRes = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM users
      WHERE subscription = 'paid'
    `).first();

    // =========================
    // TOTAL REVENUE
    // =========================
    const revenueRes = await env.DB.prepare(`
      SELECT SUM(amount) as total FROM transactions
      WHERE type = 'spend'
    `).first();

    // =========================
    // QUIZ / TASK COUNT
    // =========================
    const quizRes = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM tasks
      WHERE type = 'quiz'
      AND status = 'approved'
    `).first();

    return success({
      users: usersRes?.total || 0,
      premium: premiumRes?.total || 0,
      revenue: revenueRes?.total || 0,
      quiz: quizRes?.total || 0
    });

  } catch (err) {
    return error("Erreur analytics");
  }
}
