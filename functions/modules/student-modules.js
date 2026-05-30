// functions/modules/student-module.js
// Dashboard étudiant – version corrigée avec points basés sur earnings, ranking cohérent

import { ok, unauthorized, notFound, withErrorHandler } from "../core/errorHandler.js";

// =========================
// CONFIGURATION DES NIVEAUX (BAR)
// =========================
const LEVELS = [
  { name: "Green Star", points: 0, icon: "🌟" },
  { name: "Blue Star", points: 5000, icon: "💙" },
  { name: "Gold Star", points: 10000, icon: "⭐" },
  { name: "Lead Star", points: 15000, icon: "✨" },
  { name: "Mentor", points: 20000, icon: "🎓" },
  { name: "Crystal Mag", points: 25000, icon: "🔮" }
];

// Rôles autorisés pour le classement
const STUDENT_ROLES = new Set(['student', 'user']);

// Types de tâches valides (whitelist)
const VALID_TASK_TYPES = new Set([
  'video', 'quiz', 'conference', 'report', 'exposure', 'prospect', 'campaign', 'timer'
]);

// =========================
// CALCUL DU NIVEAU (optimisé)
// =========================
function calculateLevel(points) {
  const safePoints = Math.max(0, points || 0);
  let current = LEVELS[0];
  let next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (safePoints >= LEVELS[i].points) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  let progress = 100;
  let pointsToNext = 0;
  if (next) {
    const range = next.points - current.points;
    const achieved = safePoints - current.points;
    progress = (achieved / range) * 100;
    progress = Math.min(100, Math.max(0, progress));
    pointsToNext = next.points - safePoints;
  }
  return {
    currentLevel: current.name,
    currentIcon: current.icon,
    nextLevel: next ? next.name : null,
    nextIcon: next ? next.icon : null,
    progress: Math.round(progress),
    pointsToNext: Math.max(0, pointsToNext),
    totalPoints: safePoints
  };
}

// =========================
// MASQUER EMAIL (pour le classement)
// =========================
function maskEmail(email) {
  if (!email) return 'inconnu';
  const [local, domain] = email.split('@');
  if (!domain) return email.substring(0, 2) + '***';
  const maskedLocal = local.length <= 2 ? local : local.substring(0, 2) + '***';
  return `${maskedLocal}@${domain}`;
}

// =========================
// RÉCUPÉRATION DU TOTAL DES POINTS (depuis earnings) – source unique
// =========================
async function getTotalPointsFromEarnings(env, userId) {
  const result = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM earnings WHERE user_id = ?
  `).bind(userId).first();
  return result?.total || 0;
}

// =========================
// RÉCUPÉRATION DU PROFIL UTILISATEUR + BALANCE + POINTS (1 seule requête)
// =========================
async function getUserFullData(env, userId) {
  // Une seule requête pour user + balance + points (via sous-requête)
  const user = await env.DB.prepare(`
    SELECT 
      u.id, u.email, u.role, u.balance,
      COALESCE((SELECT SUM(amount) FROM earnings WHERE user_id = u.id), 0) as total_points
    FROM users u
    WHERE u.id = ?
  `).bind(userId).first();
  return user;
}

// =========================
// RÉCUPÉRATION DES TÂCHES (avec validation)
// =========================
async function getUserTasks(env, userId) {
  const tasks = await env.DB.prepare(`
    SELECT id, type, description, status, value, created_at
    FROM tasks WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(userId).all();
  // Filtrer les types non valides
  return (tasks.results || []).filter(t => VALID_TASK_TYPES.has(t.type));
}

// =========================
// DASHBOARD ÉTUDIANT (utilise earnings pour les points)
// =========================
export const getStudentDashboard = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const userData = await getUserFullData(env, user.id);
  if (!userData) return notFound("Utilisateur introuvable");

  const tasks = await getUserTasks(env, user.id);
  const totalPoints = userData.total_points; // cohérent avec le classement
  const levelInfo = calculateLevel(totalPoints);

  return ok({
    user: {
      id: userData.id,
      email: userData.email,
      role: userData.role || "student"
    },
    balance: userData.balance || 0,
    points: totalPoints,
    level: levelInfo.currentLevel,
    nextLevel: levelInfo.nextLevel,
    progress: levelInfo.progress,
    tasks: tasks.map(t => ({
      id: t.id,
      type: t.type,
      description: t.description,
      status: t.status,
      created_at: t.created_at
    }))
  });
});

// =========================
// PROGRESSION ÉTUDIANT (statistiques)
// =========================
export const getStudentProgress = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const tasks = await getUserTasks(env, user.id);
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'approved').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const rejected = tasks.filter(t => t.status === 'rejected').length;
  const totalPoints = await getTotalPointsFromEarnings(env, user.id);
  const levelInfo = calculateLevel(totalPoints);

  return ok({
    progress: {
      total_tasks: total,
      completed_tasks: completed,
      pending_tasks: pending,
      rejected_tasks: rejected,
      completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0
    },
    points: totalPoints,
    level: levelInfo.currentLevel,
    nextLevel: levelInfo.nextLevel,
    points_to_next_level: levelInfo.pointsToNext
  });
});

// =========================
// CLASSEMENT ÉTUDIANT (admin) – utilise earnings pour cohérence
// =========================
export const getStudentRanking = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== 'admin') return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);

  // Une seule requête pour le classement avec les points depuis earnings
  const ranking = await env.DB.prepare(`
    SELECT 
      u.id,
      u.email,
      u.role,
      COALESCE(SUM(e.amount), 0) as total_points
    FROM users u
    LEFT JOIN earnings e ON e.user_id = u.id
    WHERE u.role IN ('student', 'user')
    GROUP BY u.id
    ORDER BY total_points DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM users WHERE role IN ('student', 'user')
  `).first();

  // Masquer les emails partiellement
  const rankingWithMask = (ranking.results || []).map(entry => ({
    id: entry.id,
    email: maskEmail(entry.email),
    role: entry.role,
    total_points: entry.total_points
  }));

  return ok({
    ranking: rankingWithMask,
    pagination: {
      limit,
      offset,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  });
});
