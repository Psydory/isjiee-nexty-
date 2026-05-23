// functions/modules/task-module.js
// Gestion des tâches – version production (rate limiting, sanitize, validation stricte)

import { ok, badRequest, unauthorized, forbidden, notFound, tooManyRequests, withErrorHandler } from "../core/errorHandler.js";
import { checkRateLimitD1 } from "../core/rate-limit.js";

// =========================
// CONFIGURATION
// =========================
const TASK_POINTS_MAP = {
  video: 50,
  quiz: 100,
  conference: 150,
  report: 200,
  exposure: 150,
  prospect: 120,
  campaign: 180,
  timer: 1
};

const VALID_TASK_TYPES = Object.keys(TASK_POINTS_MAP);
const VALID_TASK_STATUS = ["pending", "approved", "rejected"];
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_META_SIZE = 2000;          // taille max JSON stringifiée
const MAX_VALUE = 100;               // valeur max que l'utilisateur peut ajouter (timer)
const DAILY_TASK_LIMIT = 20;         // nombre max de soumissions par jour

// =========================
// GÉNÉRER ID
// =========================
function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

// =========================
// SANITIZER (anti-XSS)
// =========================
function sanitizeString(str, maxLength = MAX_DESCRIPTION_LENGTH) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/[<>]/g, "")           // supprimer balises HTML
    .trim()
    .substring(0, maxLength);
}

function sanitizeMeta(meta) {
  if (!meta) return null;
  try {
    let metaStr;
    if (typeof meta === "object") {
      metaStr = JSON.stringify(meta);
    } else if (typeof meta === "string") {
      metaStr = meta;
    } else {
      return null;
    }
    if (metaStr.length > MAX_META_SIZE) throw new Error("Meta too large");
    return metaStr;
  } catch {
    return null;
  }
}

// =========================
// SOUMETTRE UNE TÂCHE (utilisateur) – avec rate limiting et validation value
// =========================
export const submitTask = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  // Rate limiting global par utilisateur
  const rateKey = `task:${user.id}`;
  const rateOk = await checkRateLimitD1(env, rateKey, DAILY_TASK_LIMIT, 86400000); // 20 par jour
  if (!rateOk.allowed) return tooManyRequests(`Maximum ${DAILY_TASK_LIMIT} tasks per day`);

  const { type, description, meta = "", value = 0 } = await request.json();

  if (!type || !description) return badRequest("Type and description required");
  if (!VALID_TASK_TYPES.includes(type)) {
    return badRequest(`Invalid task type. Must be: ${VALID_TASK_TYPES.join(", ")}`);
  }

  const cleanDesc = sanitizeString(description);
  if (cleanDesc.length === 0) return badRequest("Description required");

  // Validation de la valeur supplémentaire (timer notamment)
  let extraValue = 0;
  if (value !== undefined) {
    extraValue = Math.min(MAX_VALUE, Math.max(0, Number(value) || 0));
  }

  const metaSafe = sanitizeMeta(meta);

  const id = generateId();
  const now = Date.now();
  const basePoints = TASK_POINTS_MAP[type];
  const totalPoints = basePoints + extraValue;

  await env.DB.prepare(`
    INSERT INTO tasks (id, user_id, type, description, meta, status, value, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(id, user.id, type, cleanDesc, metaSafe, totalPoints, now, now).run();

  // Ne pas logger les emails en production
  console.log(`[TASK] User ${user.id} submitted task: ${id} (${type})`);

  return ok({
    message: "Task submitted successfully",
    task: { id, type, description: cleanDesc, status: "pending", value: totalPoints }
  });
});

// =========================
// RÉCUPÉRER LES TÂCHES DE L'UTILISATEUR (avec pagination complète)
// =========================
export const getTasks = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const url = new URL(request.url);
  let status = url.searchParams.get("status") || null;
  if (status && !VALID_TASK_STATUS.includes(status)) {
    return badRequest(`Invalid status. Must be one of: ${VALID_TASK_STATUS.join(", ")}`);
  }

  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);

  let query = `
    SELECT id, type, description, status, value, created_at, updated_at
    FROM tasks WHERE user_id = ?
  `;
  const params = [user.id];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const tasks = await env.DB.prepare(query).bind(...params).all();
  const total = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM tasks WHERE user_id = ?
  `).bind(user.id).first();

  const totalPages = Math.ceil((total?.total || 0) / limit);
  const hasNext = offset + limit < (total?.total || 0);
  const hasPrev = offset > 0;

  return ok({
    tasks: tasks.results || [],
    pagination: {
      limit,
      offset,
      total: total?.total || 0,
      pages: totalPages,
      hasNext,
      hasPrev
    }
  });
});

// =========================
// RÉCUPÉRER UNE TÂCHE PAR ID (utilisateur ou admin)
// =========================
export const getTaskById = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("Task ID required");

  const task = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first();
  if (!task) return notFound("Task not found");
  if (task.user_id !== user.id && user.role !== "admin") {
    return forbidden("Access denied");
  }

  return ok({ task });
});

// =========================
// VALIDER UNE TÂCHE (admin seulement) – avec transaction robuste (batch)
// =========================
export const validateTask = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== "admin") {
    return forbidden("Admin access required");
  }

  const { taskId, status, adminComment } = await request.json();
  if (!taskId || !status) return badRequest("Task ID and status required");
  if (!VALID_TASK_STATUS.includes(status)) {
    return badRequest(`Invalid status. Must be: ${VALID_TASK_STATUS.join(", ")}`);
  }

  const task = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first();
  if (!task) return notFound("Task not found");
  if (task.user_id === user.id) return forbidden("Cannot validate your own task");
  if (task.status !== "pending") return badRequest(`Task already ${task.status}`);

  let points = task.value;
  if (!points || points <= 0) {
    points = TASK_POINTS_MAP[task.type] || 50;
  }
  if (points <= 0) return badRequest("Invalid points value for this task");

  const now = Date.now();

  // Utilisation de batch pour D1 (plus fiable que BEGIN/COMMIT)
  const statements = [];

  statements.push({
    sql: `UPDATE tasks SET status = ?, admin_comment = ?, updated_at = ? WHERE id = ?`,
    args: [status, adminComment || null, now, taskId]
  });

  if (status === "approved") {
    statements.push({
      sql: `UPDATE users SET balance = balance + ?, updated_at = ? WHERE id = ?`,
      args: [points, now, task.user_id]
    });
    statements.push({
      sql: `INSERT INTO earnings (user_id, source, amount, created_at) VALUES (?, ?, ?, ?)`,
      args: [task.user_id, `task_${task.type}`, points, now]
    });
  }

  await env.DB.batch(statements);

  console.log(`[ADMIN] Admin ${user.id} ${status} task ${taskId} for user ${task.user_id} (+${points} points)`);

  return ok({
    message: `Task ${status} successfully`,
    taskId,
    status,
    points: status === "approved" ? points : 0
  });
});

// =========================
// LISTE DE TOUTES LES TÂCHES (admin seulement)
// =========================
export const getAllTasks = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== "admin") return forbidden();

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || null;
  if (status && !VALID_TASK_STATUS.includes(status)) {
    return badRequest(`Invalid status. Must be: ${VALID_TASK_STATUS.join(", ")}`);
  }

  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);

  let query = `
    SELECT t.id, t.user_id, t.type, t.description, t.status, t.value,
           t.created_at, t.updated_at, u.email as user_email
    FROM tasks t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND t.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const tasks = await env.DB.prepare(query).bind(...params).all();

  let countQuery = `SELECT COUNT(*) as total FROM tasks WHERE 1=1`;
  const countParams = [];
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  const total = await env.DB.prepare(countQuery).bind(...countParams).first();

  const totalPages = Math.ceil((total?.total || 0) / limit);
  const hasNext = offset + limit < (total?.total || 0);
  const hasPrev = offset > 0;

  return ok({
    tasks: tasks.results || [],
    pagination: {
      limit,
      offset,
      total: total?.total || 0,
      pages: totalPages,
      hasNext,
      hasPrev
    }
  });
});