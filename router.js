// =========================
// IMPORTS
// =========================
import { safeHandler, rateLimit } from "./core/security.js";
import { requireAuth } from "./core/security.js";

// MEDIA
import {
  createUploadUrl,
  validateAndSaveMedia,
  getMediaGallery,
  deleteMedia,
  addView,
  addLike
} from "./modules/media.js";

// =========================
// HELPERS
// =========================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

// =========================
// RATE LIMIT
// =========================
function globalRateLimit(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (!rateLimit("global:" + ip, 100, 60000)) {
    return json({ error: "Too many requests" }, 429);
  }

  return null;
}

// =========================
// ROUTER
// =========================
export default {
  fetch: safeHandler(async (request, env) => {

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 🔒 RATE LIMIT GLOBAL
    const rl = globalRateLimit(request);
    if (rl) return rl;

    // =========================
    // AUTH USER (inject)
    // =========================
    let user = null;

    try {
      user = requireAuth(request);
      request.user = user;
    } catch {
      // user non connecté (autorisé pour public)
    }

    // =========================
    // HEALTH
    // =========================
    if (path === "/health") {
      return json({ status: "ok" });
    }

    // =========================
    // MEDIA
    // =========================

    // GET MEDIA (public ou user)
    if (path === "/media" && method === "GET") {
      return getMediaGallery(request, env);
    }

    // CREATE UPLOAD URL (auth requis)
    if (path === "/media/upload-url" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return createUploadUrl(request, env);
    }

    // VALIDATE + SAVE
    if (path === "/media/validate" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return validateAndSaveMedia(request, env);
    }

    // DELETE
    if (path === "/media/delete" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return deleteMedia(request, env);
    }

    // ADD VIEW (public autorisé)
    if (path === "/media/view" && method === "POST") {
      return addView(request, env);
    }

    // ADD LIKE (auth recommandé)
    if (path === "/media/like" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return addLike(request, env);
    }

    // =========================
    // 404 API
    // =========================
    if (path.startsWith("/media")) {
      return json({ error: "Route not found" }, 404);
    }

    // =========================
    // FRONTEND FALLBACK
    // =========================
    return fetch(new Request(new URL("/index.html", request.url)));

  })
};