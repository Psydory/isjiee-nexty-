// =========================
// IMPORTS
// =========================
import { safeHandler, rateLimit, requireAuth } from "./core/security.js";

// AUTH
import { login, refresh, getMe } from "./auth.js";

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
// HEADERS (CORS)
// =========================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
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

    // =========================
    // CORS PREFLIGHT
    // =========================
    if (method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // =========================
    // RATE LIMIT GLOBAL
    // =========================
    const rl = globalRateLimit(request);
    if (rl) return rl;

    // =========================
    // AUTH USER (inject)
    // =========================
    let user = null;

    try {
      user = await requireAuth(request, env);
      request.user = user;
    } catch {
      // non connecté autorisé pour routes publiques
    }

    // =========================
    // HEALTH
    // =========================
    if (path === "/health") {
      return json({ status: "ok" });
    }

    // =========================
    // AUTH
    // =========================
    if (path === "/auth/login" && method === "POST") {
      return login(request, env);
    }

    if (path === "/auth/refresh" && method === "POST") {
      return refresh(request, env);
    }

    if (path === "/auth/me" && method === "GET") {
      return getMe(request, env);
    }

    // =========================
    // MEDIA
    // =========================

    if (path === "/media" && method === "GET") {
      return getMediaGallery(request, env);
    }

    if (path === "/media/upload-url" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return createUploadUrl(request, env);
    }

    if (path === "/media/validate" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return validateAndSaveMedia(request, env);
    }

    if (path === "/media/delete" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return deleteMedia(request, env);
    }

    if (path === "/media/view" && method === "POST") {
      return addView(request, env);
    }

    if (path === "/media/like" && method === "POST") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      return addLike(request, env);
    }

    // =========================
    // 404 API
    // =========================
    if (path.startsWith("/media") || path.startsWith("/auth")) {
      return json({ error: "Route not found" }, 404);
    }

    // =========================
    // FRONTEND FALLBACK
    // =========================
    return fetch(new Request(new URL("/index.html", request.url)));

  })
};