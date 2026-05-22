// functions/modules/admin.js
// Backend – Fonctions d'administration (statistiques, modération, gestion utilisateurs)
// Version avec transactions, audit logs, soft delete, validation renforcée

import { ok, badRequest, notFound, forbidden, withErrorHandler } from "../core/errorHandler.js";
import { validateUUID } from "../core/security.js";

// =========================
// CONSTANTES ET HELPERS
// =========================
const VALID_STATUSES = ["pending", "approved", "rejected"];
const VALID_ROLES = ["user", "moderator", "admin"];
const MAX_BAN_REASON_LENGTH = 500;
const MAX_REJECTION_REASON_LENGTH = 500;

// Audit log helper
async function logAdminAction(env, adminId, action, targetId, details = {}, ip = null) {
  await env.DB.prepare(`
    INSERT INTO admin_logs (admin_id, action, target_id, details, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(adminId, action, targetId, JSON.stringify(details), ip || null, Date.now()).run();
}

// Soft delete media (marque deleted_at au lieu de supprimer)
async function softDeleteMedia(env, mediaId, deletedBy, ip) {
  await env.DB.prepare(`
    UPDATE media
    SET deleted_at = ?, deleted_by = ?
    WHERE id = ?
  `).bind(Date.now(), deletedBy, mediaId).run();
}

// =========================
// STATISTIQUES GLOBALES
// =========================
export const getStats = withErrorHandler(async (request, env, user) => {
  const [media, users, featured, pending] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as count FROM media WHERE deleted_at IS NULL`).first(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM media WHERE featured = 1 AND deleted_at IS NULL`).first(),
    env.DB.prepare(`SELECT COUNT(*) as count FROM media WHERE status = 'pending' AND deleted_at IS NULL`).first()
  ]);

  await logAdminAction(env, user.id, "view_stats", null, {}, request.headers.get("cf-connecting-ip"));

  return ok({
    stats: {
      media: media?.count || 0,
      users: users?.count || 0,
      featured: featured?.count || 0,
      pending: pending?.count || 0
    }
  });
});

// =========================
// LISTE DES MÉDIAS (admin) – paginée, sans soft-deleted
// =========================
export const getAllMedia = withErrorHandler(async (request, env, user) => {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 20);
  const offset = (page - 1) * limit;

  const totalResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM media WHERE deleted_at IS NULL`).first();
  const list = await env.DB.prepare(`
    SELECT m.id, m.user_id, u.email as user_email, m.type, m.title, m.visibility,
           m.likes, m.views, m.featured, m.status, m.created_at
    FROM media m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return ok({
    media: list.results || [],
    pagination: {
      page,
      limit,
      total: totalResult?.total || 0,
      pages: Math.ceil((totalResult?.total || 0) / limit)
    }
  });
});

// =========================
// DÉTAIL D'UN MÉDIA (admin)
// =========================
export const getMediaById = withErrorHandler(async (request, env, user) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!validateUUID(id)) return badRequest("Invalid media ID");

  const media = await env.DB.prepare(`
    SELECT m.id, m.user_id, m.type, m.title, m.description, m.visibility,
           m.likes, m.views, m.featured, m.status, m.rejection_reason,
           m.created_at, m.updated_at, u.email as user_email
    FROM media m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.id = ? AND m.deleted_at IS NULL
  `).bind(id).first();

  if (!media) return notFound("Media not found");
  return ok({ media });
});

// =========================
// MODÉRATION D'UN MÉDIA (avec transaction)
// =========================
export const moderateMedia = withErrorHandler(async (request, env, user) => {
  const { id, status, rejection_reason } = await request.json();
  if (!id || !status) return badRequest("Missing id or status");
  if (!VALID_STATUSES.includes(status)) return badRequest("Invalid status value");
  if (!validateUUID(id)) return badRequest("Invalid media ID");

  const media = await env.DB.prepare(`SELECT user_id FROM media WHERE id = ? AND deleted_at IS NULL`).bind(id).first();
  if (!media) return notFound("Media not found");

  if (media.user_id === user.id) return forbidden("Cannot moderate your own content");

  const cleanReason = rejection_reason
    ? rejection_reason.replace(/[<>]/g, "").substring(0, MAX_REJECTION_REASON_LENGTH)
    : null;

  const now = Date.now();
  const ip = request.headers.get("cf-connecting-ip");

  // Transaction
  await env.DB.prepare("BEGIN TRANSACTION").run();
  try {
    await env.DB.prepare(`
      UPDATE media
      SET status = ?, rejection_reason = ?, moderated_at = ?, moderated_by = ?
      WHERE id = ?
    `).bind(status, cleanReason, now, user.id, id).run();

    await logAdminAction(env, user.id, "moderate_media", id, { status, rejection_reason: cleanReason }, ip);
    await env.DB.prepare("COMMIT").run();
  } catch (err) {
    await env.DB.prepare("ROLLBACK").run();
    throw err;
  }

  return ok({ success: true });
});

// =========================
// MISE EN AVANT D'UN MÉDIA
// =========================
export const featureMedia = withErrorHandler(async (request, env, user) => {
  const { id, featured } = await request.json();
  if (!id) return badRequest("Missing media ID");
  if (!validateUUID(id)) return badRequest("Invalid media ID");

  const featuredValue = (featured === true || featured === 1 || featured === "1" || featured === "true") ? 1 : 0;

  const media = await env.DB.prepare(`SELECT id FROM media WHERE id = ? AND deleted_at IS NULL`).bind(id).first();
  if (!media) return notFound("Media not found");

  await env.DB.prepare(`UPDATE media SET featured = ? WHERE id = ?`).bind(featuredValue, id).run();

  const ip = request.headers.get("cf-connecting-ip");
  await logAdminAction(env, user.id, "feature_media", id, { featured: featuredValue }, ip);

  return ok({ success: true });
});

// =========================
// SUPPRESSION D'UN MÉDIA (soft delete + R2 puis hard delete programmé)
// =========================
export const deleteMedia = withErrorHandler(async (request, env, user) => {
  const { id } = await request.json();
  if (!id) return badRequest("Missing media ID");
  if (!validateUUID(id)) return badRequest("Invalid media ID");

  const media = await env.DB.prepare(`SELECT user_id, r2_key FROM media WHERE id = ? AND deleted_at IS NULL`).bind(id).first();
  if (!media) return notFound("Media not found");

  // Soft delete d'abord (marque deleted_at)
  const ip = request.headers.get("cf-connecting-ip");
  await env.DB.prepare("BEGIN TRANSACTION").run();
  try {
    await softDeleteMedia(env, id, user.id, ip);
    await logAdminAction(env, user.id, "delete_media", id, { r2_key: media.r2_key }, ip);
    await env.DB.prepare("COMMIT").run();
  } catch (err) {
    await env.DB.prepare("ROLLBACK").run();
    throw err;
  }

  // Supprimer du bucket R2 de manière asynchrone (pour ne pas bloquer la réponse)
  if (env.MEDIA_BUCKET && media.r2_key) {
    env.MEDIA_BUCKET.delete(media.r2_key).catch(err => console.error("R2 delete error:", err));
  }

  // Supprimer les likes associés (transaction séparée)
  await env.DB.prepare(`DELETE FROM likes WHERE media_id = ?`).bind(id).run();

  return ok({ success: true });
});

// =========================
// LISTE DES UTILISATEURS (admin) – paginée, avec recherche case-insensitive
// =========================
export const getUsers = withErrorHandler(async (request, env, user) => {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit")) || 20);
  const offset = (page - 1) * limit;
  const search = url.searchParams.get("search") || "";

  let query = `SELECT id, email, role, banned, created_at FROM users WHERE 1=1`;
  const params = [];

  if (search) {
    query += ` AND LOWER(email) LIKE ?`;
    params.push(`%${search.toLowerCase()}%`);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const totalQuery = `SELECT COUNT(*) as total FROM users WHERE 1=1${search ? ' AND LOWER(email) LIKE ?' : ''}`;
  const totalParams = search ? [`%${search.toLowerCase()}%`] : [];
  const totalResult = await env.DB.prepare(totalQuery).bind(...totalParams).first();

  const usersList = await env.DB.prepare(query).bind(...params).all();

  return ok({
    users: usersList.results || [],
    pagination: {
      page,
      limit,
      total: totalResult?.total || 0,
      pages: Math.ceil((totalResult?.total || 0) / limit)
    }
  });
});

// =========================
// DÉTAIL D'UN UTILISATEUR (admin)
// =========================
export const getUserById = withErrorHandler(async (request, env, user) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!validateUUID(id)) return badRequest("Invalid user ID");

  const targetUser = await env.DB.prepare(`
    SELECT id, email, role, banned, ban_reason, created_at
    FROM users WHERE id = ?
  `).bind(id).first();

  if (!targetUser) return notFound("User not found");

  const media = await env.DB.prepare(`
    SELECT id, title, type, likes, views, status, created_at
    FROM media WHERE user_id = ? AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 20
  `).bind(id).all();

  return ok({ user: targetUser, media: media.results || [] });
});

// =========================
// BAN / UNBAN D'UN UTILISATEUR (avec audit)
// =========================
export const banUser = withErrorHandler(async (request, env, user) => {
  const { id, banned, ban_reason } = await request.json();
  if (!id) return badRequest("Missing user ID");
  if (!validateUUID(id)) return badRequest("Invalid user ID");

  if (id === user.id) return forbidden("You cannot ban yourself");

  const targetUser = await env.DB.prepare(`SELECT role FROM users WHERE id = ?`).bind(id).first();
  if (!targetUser) return notFound("User not found");

  // Seul un admin peut bannir un modérateur ou un utilisateur normal
  if (targetUser.role === "admin" && user.role !== "super_admin") {
    return forbidden("Cannot ban another admin");
  }

  const bannedValue = (banned === true || banned === 1 || banned === "1" || banned === "true") ? 1 : 0;
  const cleanReason = ban_reason ? ban_reason.replace(/[<>]/g, "").substring(0, MAX_BAN_REASON_LENGTH) : null;

  const ip = request.headers.get("cf-connecting-ip");
  await env.DB.prepare("BEGIN TRANSACTION").run();
  try {
    await env.DB.prepare(`
      UPDATE users
      SET banned = ?, ban_reason = ?, banned_at = ?, banned_by = ?
      WHERE id = ?
    `).bind(bannedValue, cleanReason, bannedValue ? Date.now() : null, user.id, id).run();

    await logAdminAction(env, user.id, bannedValue ? "ban_user" : "unban_user", id, { reason: cleanReason }, ip);
    await env.DB.prepare("COMMIT").run();
  } catch (err) {
    await env.DB.prepare("ROLLBACK").run();
    throw err;
  }

  return ok({ success: true });
});

// =========================
// CHANGEMENT DE RÔLE D'UN UTILISATEUR
// =========================
export const updateUserRole = withErrorHandler(async (request, env, user) => {
  const { id, role } = await request.json();
  if (!id || !role) return badRequest("Missing user ID or role");
  if (!validateUUID(id)) return badRequest("Invalid user ID");
  if (!VALID_ROLES.includes(role)) return badRequest("Invalid role");

  if (id === user.id) return forbidden("You cannot change your own role");

  const targetUser = await env.DB.prepare(`SELECT role FROM users WHERE id = ?`).bind(id).first();
  if (!targetUser) return notFound("User not found");

  // Seul un super_admin peut modifier le rôle d'un admin
  if (targetUser.role === "admin" && user.role !== "super_admin") {
    return forbidden("Only super admin can change admin roles");
  }

  const ip = request.headers.get("cf-connecting-ip");
  await env.DB.prepare("BEGIN TRANSACTION").run();
  try {
    await env.DB.prepare(`UPDATE users SET role = ? WHERE id = ?`).bind(role, id).run();
    await logAdminAction(env, user.id, "update_user_role", id, { old_role: targetUser.role, new_role: role }, ip);
    await env.DB.prepare("COMMIT").run();
  } catch (err) {
    await env.DB.prepare("ROLLBACK").run();
    throw err;
  }

  return ok({ success: true });
});