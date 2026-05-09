// =========================
// IMPORTS
// =========================
import { requireAuth, requireAdmin } from "../core/security.js";

// =========================
// HEADERS
// =========================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};

// =========================
// HELPERS
// =========================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

// =========================
// AUTH ADMIN WRAPPER
// =========================
async function getAdmin(request, env) {

  const user = await requireAuth(request, env);

  if (!user) {
    throw new Error("Unauthorized");
  }

  requireAdmin(user);

  return user;
}

// =========================
// STATS
// =========================
export async function getStats(request, env) {

  try {

    await getAdmin(request, env);

    const media = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM media"
    ).first();

    const users = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM users"
    ).first();

    return json({
      media: media?.count || 0,
      users: users?.count || 0
    });

  } catch (err) {
    return json({ error: err.message || "Forbidden" }, 403);
  }
}

// =========================
// GET ALL MEDIA
// =========================
export async function getAllMedia(request, env) {

  try {

    await getAdmin(request, env);

    const list = await env.DB.prepare(
      "SELECT * FROM media ORDER BY id DESC"
    ).all();

    return json({ media: list.results || [] });

  } catch (err) {
    return json({ error: err.message || "Forbidden" }, 403);
  }
}

// =========================
// MODERATE MEDIA
// =========================
export async function moderateMedia(request, env) {

  try {

    await getAdmin(request, env);

    const { id, status } = await request.json();

    if (!id || !status) {
      return json({ error: "Invalid data" }, 400);
    }

    await env.DB.prepare(
      "UPDATE media SET status = ? WHERE id = ?"
    ).bind(status, id).run();

    return json({ success: true });

  } catch (err) {
    return json({ error: err.message || "Forbidden" }, 403);
  }
}

// =========================
// FEATURE MEDIA
// =========================
export async function featureMedia(request, env) {

  try {

    await getAdmin(request, env);

    const { id, featured } = await request.json();

    if (!id) {
      return json({ error: "Invalid ID" }, 400);
    }

    await env.DB.prepare(
      "UPDATE media SET featured = ? WHERE id = ?"
    ).bind(featured ? 1 : 0, id).run();

    return json({ success: true });

  } catch (err) {
    return json({ error: err.message || "Forbidden" }, 403);
  }
}

// =========================
// GET USERS
// =========================
export async function getUsers(request, env) {

  try {

    await getAdmin(request, env);

    const users = await env.DB.prepare(
      "SELECT id, role, banned FROM users ORDER BY id DESC"
    ).all();

    return json({ users: users.results || [] });

  } catch (err) {
    return json({ error: err.message || "Forbidden" }, 403);
  }
}

// =========================
// BAN USER
// =========================
export async function banUser(request, env) {

  try {

    await getAdmin(request, env);

    const { id, banned } = await request.json();

    if (!id) {
      return json({ error: "Invalid ID" }, 400);
    }

    await env.DB.prepare(
      "UPDATE users SET banned = ? WHERE id = ?"
    ).bind(banned ? 1 : 0, id).run();

    return json({ success: true });

  } catch (err) {
    return json({ error: err.message || "Forbidden" }, 403);
  }
}
