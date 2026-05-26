// =========================
// IMPORTS
// =========================
import { ok, badRequest, unauthorized, notFound, serverError, withErrorHandler } from "./core/errorHandler.js";

// =========================
// CONSTANTES
// =========================
const MAX_TAGS = 20;
const MAX_MEDIA_PER_USER = 500;
const MAX_FILENAME_LENGTH = 255;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

// =========================
// HELPERS
// =========================
function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now() + '-' + Math.random().toString(36).substring(2);
  }
}

function sanitizeString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '').substring(0, maxLength);
}

function sanitizeTags(tags) {
  if (!tags || typeof tags !== 'string') return '';
  return tags.split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t && t.length < 30)
    .slice(0, MAX_TAGS)
    .join(',');
}

// =========================
// CREATE UPLOAD URL
// =========================
export const createUploadUrl = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const { type, filename } = await request.json();

  if (!type || !["image", "video"].includes(type)) {
    return badRequest("Invalid type. Must be 'image' or 'video'");
  }

  if (!filename || filename.length > MAX_FILENAME_LENGTH) {
    return badRequest("Invalid filename");
  }

  if (!env.MEDIA_BUCKET) {
    return serverError("Storage not configured");
  }

  const mediaCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM media WHERE user_id = ?
  `).bind(user.id).first();

  if (mediaCount?.count >= MAX_MEDIA_PER_USER) {
    return badRequest(`Maximum ${MAX_MEDIA_PER_USER} media per user`);
  }

  const id = generateId();
  const extension = filename.split('.').pop();
  const key = `media/${id}.${extension}`;

  const uploadUrl = await env.MEDIA_BUCKET.createMultipartUpload(key);

  return ok({ id, key, uploadUrl });
});

// =========================
// VALIDATE AND SAVE MEDIA
// =========================
export const validateAndSaveMedia = withErrorHandler(async (request, env, user) => {
  if (!user) return unauthorized();

  const { id, key, type, title, description, visibility, tags } = await request.json();

  if (!id || !key || !type) {
    return badRequest("Missing required fields: id, key, type");
  }

  if (!["image", "video"].includes(type)) {
    return badRequest("Invalid type");
  }

  const cleanTitle = sanitizeString(title, MAX_TITLE_LENGTH);
  const cleanDesc = sanitizeString(description, MAX_DESCRIPTION_LENGTH);
  const cleanTags = sanitizeTags(tags);
  const cleanVisibility = visibility === 'public' ? 'public' : 'private';
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO media (id, user_id, url, type, title, description, thumbnail, visibility, tags, likes, views, featured, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'pending', ?, ?)
  `).bind(id, user.id, key, type, cleanTitle, cleanDesc, "", cleanVisibility, cleanTags, now, now).run();

  return ok({ mediaId: id });
});

// =========================
// GET MEDIA GALLERY
// =========================
export const getMediaGallery = withErrorHandler(async (request, env, user) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "public";
  const page = Math.max(1, parseInt(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit")) || 20);
  const offset = (page - 1) * limit;

  let query, params = [];

  if (mode === "user") {
    if (!user) return unauthorized();
    query = `SELECT * FROM media WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params = [user.id, limit, offset];
  } else {
    query = `SELECT * FROM media WHERE visibility = 'public' AND status = 'approved' ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params = [limit, offset];
  }

  const result = await env.DB.prepare(query).bind(...params).all();

  let totalQuery = mode === "user" 
    ? `SELECT COUNT(*) as total FROM media WHERE user_id = ?`
    : `SELECT COUNT(*) as total FROM media WHERE visibility = 'public' AND status = 'approved'`;
  
  const totalParams = mode === "user" && user ? [user.id] : [];
  const total = await env.DB.prepare(totalQuery).bind(...totalParams).first();

  return ok({
    media: result.results || [],
    pagination: {
      page,
      limit,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  });
});

// =========================
// GET SINGLE MEDIA
// =========================
export const getMediaById = withErrorHandler(async (request, env, user) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) return badRequest("Missing media id");

  const media = await env.DB.prepare(`
    SELECT m.*, u.email as user_email
    FROM media m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).bind(id).first();

  if (!media) return notFound("Media not found");

  if (!user || user.id !== media.user_id) {
    await env.DB.prepare(`UPDATE media SET views = views + 1 WHERE id = ?`).bind(id).run();
    media.views = (media.views || 0) + 1;
  }

  return ok({ media });
});

// =========================
// DELETE MEDIA
// =========================
export const deleteMedia = withErrorHandler(async (request, env, user) => {
  const { id } = await request.json();

  if (!id) return badRequest("Missing media id");
  if (!user) return unauthorized();

  const media = await env.DB.prepare(`SELECT * FROM media WHERE id = ?`).bind(id).first();

  if (!media) return notFound("Media not found");

  if (media.user_id !== user.id && user.role !== "admin") {
    return unauthorized("You don't own this media");
  }

  await env.DB.prepare(`DELETE FROM media WHERE id = ?`).bind(id).run();

  try {
    if (env.MEDIA_BUCKET && media.url) {
      await env.MEDIA_BUCKET.delete(media.url);
    }
  } catch (err) {
    console.error("R2 delete error:", err);
  }

  await env.DB.prepare(`DELETE FROM likes WHERE media_id = ?`).bind(id).run();

  return ok({ success: true });
});

// =========================
// UPDATE MEDIA
// =========================
export const updateMedia = withErrorHandler(async (request, env, user) => {
  const { id, title, description, visibility, tags } = await request.json();

  if (!id) return badRequest("Missing media id");
  if (!user) return unauthorized();

  const media = await env.DB.prepare(`SELECT * FROM media WHERE id = ?`).bind(id).first();

  if (!media) return notFound("Media not found");
  if (media.user_id !== user.id && user.role !== "admin") {
    return unauthorized("You don't own this media");
  }

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push("title = ?");
    params.push(sanitizeString(title, MAX_TITLE_LENGTH));
  }
  if (description !== undefined) {
    updates.push("description = ?");
    params.push(sanitizeString(description, MAX_DESCRIPTION_LENGTH));
  }
  if (visibility !== undefined) {
    updates.push("visibility = ?");
    params.push(visibility === 'public' ? 'public' : 'private');
  }
  if (tags !== undefined) {
    updates.push("tags = ?");
    params.push(sanitizeTags(tags));
  }

  if (updates.length === 0) return badRequest("No fields to update");

  params.push(Date.now(), id);

  await env.DB.prepare(`
    UPDATE media SET ${updates.join(", ")}, updated_at = ? WHERE id = ?
  `).bind(...params).run();

  return ok({ success: true });
});

// =========================
// ADD VIEW
// =========================
export const addView = withErrorHandler(async (request, env) => {
  const { id } = await request.json();

  if (!id) return badRequest("Missing media id");

  await env.DB.prepare(`UPDATE media SET views = views + 1 WHERE id = ?`).bind(id).run();

  return ok({ success: true });
});

// =========================
// ADD LIKE
// =========================
export const addLike = withErrorHandler(async (request, env, user) => {
  const { id } = await request.json();

  if (!id) return badRequest("Missing media id");
  if (!user) return unauthorized();

  const existing = await env.DB.prepare(`
    SELECT id FROM likes WHERE media_id = ? AND user_id = ?
  `).bind(id, user.id).first();

  if (existing) return badRequest("Already liked");

  await env.DB.prepare(`
    INSERT INTO likes (media_id, user_id, created_at)
    VALUES (?, ?, ?)
  `).bind(id, user.id, Date.now()).run();

  await env.DB.prepare(`UPDATE media SET likes = likes + 1 WHERE id = ?`).bind(id).run();

  return ok({ success: true });
});

// =========================
// REMOVE LIKE
// =========================
export const removeLike = withErrorHandler(async (request, env, user) => {
  const { id } = await request.json();

  if (!id) return badRequest("Missing media id");
  if (!user) return unauthorized();

  await env.DB.prepare(`DELETE FROM likes WHERE media_id = ? AND user_id = ?`)
    .bind(id, user.id).run();

  await env.DB.prepare(`UPDATE media SET likes = likes - 1 WHERE id = ? AND likes > 0`)
    .bind(id).run();

  return ok({ success: true });
});

// =========================
// GET TRENDING MEDIA
// =========================
export const getTrendingMedia = withErrorHandler(async (request, env) => {
  const url = new URL(request.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit")) || 20);

  const result = await env.DB.prepare(`
    SELECT * FROM media
    WHERE visibility = 'public' AND status = 'approved'
    ORDER BY (likes * 2 + views) DESC, created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return ok({ media: result.results || [] });
});

// =========================
// GET PERSONALIZED FEED
// =========================
export const getPersonalizedFeed = withErrorHandler(async (request, env, user) => {
  const limit = Math.min(50, parseInt(new URL(request.url).searchParams.get("limit")) || 20);

  if (!user) {
    const trending = await env.DB.prepare(`
      SELECT * FROM media
      WHERE visibility = 'public' AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();
    return ok({ media: trending.results || [], personalized: false });
  }

  const likedTags = await env.DB.prepare(`
    SELECT DISTINCT m.tags
    FROM media m
    INNER JOIN likes l ON l.media_id = m.id
    WHERE l.user_id = ? AND m.tags IS NOT NULL AND m.tags != ''
    LIMIT 20
  `).bind(user.id).all();

  let tags = [];
  for (const row of likedTags.results) {
    if (row.tags) {
      const splitTags = row.tags.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t)
        .slice(0, MAX_TAGS);
      tags.push(...splitTags);
    }
  }
  tags = [...new Set(tags)].slice(0, MAX_TAGS * 2);

  let query, params;
  if (tags.length > 0) {
    const conditions = tags.map(() => `tags LIKE ?`).join(" OR ");
    query = `
      SELECT * FROM media
      WHERE visibility = 'public' AND status = 'approved' AND (${conditions})
      ORDER BY (likes * 2 + views) DESC, created_at DESC
      LIMIT ?
    `;
    params = [...tags.map(t => `%${t}%`), limit];
  } else {
    query = `
      SELECT * FROM media
      WHERE visibility = 'public' AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT ?
    `;
    params = [limit];
  }

  const result = await env.DB.prepare(query).bind(...params).all();

  return ok({ media: result.results || [], personalized: tags.length > 0 });
});

// =========================
// GET MEDIA BY USER
// =========================
export const getMediaByUser = withErrorHandler(async (request, env) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const page = Math.max(1, parseInt(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit")) || 20);
  const offset = (page - 1) * limit;

  if (!userId) return badRequest("Missing userId");

  const result = await env.DB.prepare(`
    SELECT * FROM media
    WHERE user_id = ? AND visibility = 'public' AND status = 'approved'
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all();

  const total = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM media
    WHERE user_id = ? AND visibility = 'public' AND status = 'approved'
  `).bind(userId).first();

  return ok({
    media: result.results || [],
    pagination: {
      page,
      limit,
      total: total?.total || 0,
      pages: Math.ceil((total?.total || 0) / limit)
    }
  });
});

// =========================
// GET FEATURED MEDIA
// =========================
export const getFeaturedMedia = withErrorHandler(async (request, env) => {
  const limit = Math.min(20, parseInt(new URL(request.url).searchParams.get("limit")) || 10);

  const result = await env.DB.prepare(`
    SELECT * FROM media
    WHERE visibility = 'public' AND status = 'approved' AND featured = 1
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return ok({ media: result.results || [] });
});
