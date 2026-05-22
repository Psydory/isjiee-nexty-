// =========================
// functions/modules/project-mobiles.js
// VERSION FINALE CORRIGÉE
// =========================

import { ok, badRequest, unauthorized, forbidden, notFound, withErrorHandler } from "../core/errorHandler.js";

const VALID_PROJECT_TYPES = ["mini", "muni", "grand"];
const VALID_STATUS = ["active", "completed", "paused"];
const VALID_BUDGET_MODELS = ["bootstrap", "investisseur", "crowdfunding", "subvention"];
const MAX_PROJECTS_PER_USER = 50;
const MAX_TITLE_LENGTH = 200;

function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

// =========================
// CREATE PROJECT (avec limite)
// =========================
export const createProject = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  // Vérifier la limite de projets
  const projectCount = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM projects WHERE user_id = ?
  `).bind(user.id).first();

  if (projectCount.total >= MAX_PROJECTS_PER_USER) {
    return badRequest(`Maximum ${MAX_PROJECTS_PER_USER} projects per user`);
  }

  const body = await request.json();
  const { title, type, budgetModel, description } = body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return badRequest("Title is required");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return badRequest(`Title too long (max ${MAX_TITLE_LENGTH} chars)`);
  }
  if (!type || !VALID_PROJECT_TYPES.includes(type)) {
    return badRequest(`Invalid type. Must be: ${VALID_PROJECT_TYPES.join(", ")}`);
  }
  if (budgetModel && !VALID_BUDGET_MODELS.includes(budgetModel)) {
    return badRequest(`Invalid budget model. Must be: ${VALID_BUDGET_MODELS.join(", ")}`);
  }

  const id = generateId();
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO projects (id, user_id, title, type, budget_model, description, status, progress, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)
  `).bind(id, user.id, title.trim(), type, budgetModel || null, description?.trim() || null, now, now).run();

  console.log(`[PROJECT] User ${user.id} created project: ${id} (${type})`);

  return ok({
    project: {
      id,
      title: title.trim(),
      type,
      budgetModel: budgetModel || null,
      description: description?.trim() || null,
      status: "active",
      progress: 0,
      createdAt: now
    }
  });
});

// =========================
// GET USER PROJECTS (champs limités + tri)
// =========================
export const getUserProjects = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || null;
  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);
  
  // Tri personnalisable
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "ASC" : "DESC";
  const validSortFields = ["created_at", "updated_at", "progress", "title"];
  const finalSort = validSortFields.includes(sortBy) ? sortBy : "created_at";

  let query = `
    SELECT id, title, type, budget_model, description, status, progress, created_at, updated_at 
    FROM projects WHERE user_id = ?
  `;
  const params = [user.id];

  if (status && VALID_STATUS.includes(status)) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY ${finalSort} ${sortOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const projects = await env.DB.prepare(query).bind(...params).all();

  const total = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM projects WHERE user_id = ?
  `).bind(user.id).first();

  return ok({
    projects: projects.results || [],
    pagination: {
      limit,
      offset,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  });
});

// =========================
// UPDATE PROJECT (avec logging)
// =========================
export const updateProject = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const body = await request.json();
  const { projectId, progress, status } = body;

  if (!projectId) return badRequest("Project ID required");

  const existing = await env.DB.prepare(`
    SELECT * FROM projects WHERE id = ?
  `).bind(projectId).first();

  if (!existing) return notFound("Project not found");
  if (existing.user_id !== user.id && user.role !== "admin") {
    return forbidden("Access denied");
  }

  const updates = [];
  const params = [];

  if (progress !== undefined) {
    const validProgress = Math.max(0, Math.min(100, parseInt(progress) || 0));
    updates.push("progress = ?");
    params.push(validProgress);
  }

  if (status !== undefined) {
    if (!VALID_STATUS.includes(status)) {
      return badRequest(`Invalid status. Must be: ${VALID_STATUS.join(", ")}`);
    }
    updates.push("status = ?");
    params.push(status);
  }

  if (updates.length === 0) {
    return badRequest("No fields to update");
  }

  params.push(Date.now(), projectId);

  await env.DB.prepare(`
    UPDATE projects SET ${updates.join(", ")}, updated_at = ? WHERE id = ?
  `).bind(...params).run();

  const updated = await env.DB.prepare(`
    SELECT id, title, type, budget_model, description, status, progress, created_at, updated_at 
    FROM projects WHERE id = ?
  `).bind(projectId).first();

  console.log(`[PROJECT] User ${user.id} updated project ${projectId}: progress=${progress}, status=${status}`);

  return ok({ project: updated });
});

// =========================
// GET PROJECT BY ID (champs limités)
// =========================
export const getProjectById = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) return badRequest("Project ID required");

  const project = await env.DB.prepare(`
    SELECT id, title, type, budget_model, description, status, progress, created_at, updated_at 
    FROM projects WHERE id = ?
  `).bind(id).first();

  if (!project) return notFound("Project not found");
  if (project.user_id !== user.id && user.role !== "admin") {
    return forbidden("Access denied");
  }

  return ok({ project });
});

// =========================
// DELETE PROJECT (inchangé)
// =========================
export const deleteProject = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const body = await request.json();
  const { projectId } = body;

  if (!projectId) return badRequest("Project ID required");

  const existing = await env.DB.prepare(`
    SELECT user_id FROM projects WHERE id = ?
  `).bind(projectId).first();

  if (!existing) return notFound("Project not found");
  if (existing.user_id !== user.id && user.role !== "admin") {
    return forbidden("Access denied");
  }

  await env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(projectId).run();

  console.log(`[PROJECT] User ${user.id} deleted project ${projectId}`);

  return ok({ message: "Project deleted successfully" });
});

// =========================
// GET ALL PROJECTS (admin) - inchangé
// =========================
export const getAllProjects = withErrorHandler(async (request, env, user) => {
  if (!user || user.role !== "admin") return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);
  const status = url.searchParams.get("status") || null;

  let query = `
    SELECT p.id, p.title, p.type, p.budget_model, p.status, p.progress, 
           p.created_at, p.updated_at, u.email as user_email 
    FROM projects p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE 1=1
  `;
  const params = [];

  if (status && VALID_STATUS.includes(status)) {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const projects = await env.DB.prepare(query).bind(...params).all();

  let countQuery = `SELECT COUNT(*) as total FROM projects`;
  const countParams = [];
  if (status && VALID_STATUS.includes(status)) {
    countQuery += ` WHERE status = ?`;
    countParams.push(status);
  }
  const total = await env.DB.prepare(countQuery).bind(...countParams).first();

  return ok({
    projects: projects.results || [],
    pagination: {
      limit,
      offset,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  });
});