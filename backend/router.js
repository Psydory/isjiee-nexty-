// =========================
// IMPORTS
// =========================
import { safeHandler, rateLimit, requireAuth } from "./core/security.js";

// AUTH
import { login, refresh, getMe } from "./auth.js";

// SEED
import { seedMedia } from "./modules/seed.js";

// MEDIA
import {
  createUploadUrl,
  validateAndSaveMedia,
  getMediaGallery,
  deleteMedia,
  addView,
  addLike
} from "./modules/media.js";

// ADMIN
import {
  getStats,
  getAllMedia,
  moderateMedia,
  featureMedia,
  getUsers,
  banUser
} from "./modules/admin.js";

// =========================
// HEADERS (CORS)
// =========================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-seed-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// =========================
// HELPERS
// =========================
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

// =========================
// RATE LIMIT GLOBAL
// =========================
function applyRateLimit(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (!rateLimit("global:" + ip, 100, 60000)) {
    return json({ error: "Too many requests" }, 429);
  }

  return null;
}

// =========================
// ROUTE MAP (ULTRA RAPIDE)
// =========================
const routes = {

  // ===== HEALTH =====
  "GET /health": async () => json({ status: "ok" }),

  // ===== AUTH =====
  "POST /auth/login": (req, env) => login(req, env),
  "POST /auth/refresh": (req, env) => refresh(req, env),
  "GET /auth/me": (req, env) => getMe(req, env),

  // ===== SEED (ONE TIME) =====
  "POST /seed/media": async (req, env, user) => {

    if (!user || user.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    if (req.headers.get("x-seed-key") !== env.SEED_KEY) {
      return json({ error: "Unauthorized" }, 401);
    }

    return seedMedia(env);
  },

  // ===== ADMIN =====
  "GET /admin/stats": (req, env) => getStats(req, env),
  "GET /admin/media": (req, env) => getAllMedia(req, env),
  "POST /admin/media/moderate": (req, env) => moderateMedia(req, env),
  "POST /admin/media/feature": (req, env) => featureMedia(req, env),
  "GET /admin/users": (req, env) => getUsers(req, env),
  "POST /admin/users/ban": (req, env) => banUser(req, env),

  // ===== MEDIA =====
  "GET /media": (req, env) => getMediaGallery(req, env),

  "POST /media/upload-url": (req, env, user) => {
    if (!user) return json({ error: "Unauthorized" }, 401);
    return createUploadUrl(req, env);
  },

  "POST /media/validate": (req, env, user) => {
    if (!user) return json({ error: "Unauthorized" }, 401);
    return validateAndSaveMedia(req, env);
  },

  "POST /media/delete": (req, env, user) => {
    if (!user) return json({ error: "Unauthorized" }, 401);
    return deleteMedia(req, env);
  },

  "POST /media/view": (req, env) => addView(req, env),

  "POST /media/like": (req, env, user) => {
    if (!user) return json({ error: "Unauthorized" }, 401);
    return addLike(req, env);
  }

};

// =========================
// ROUTER CORE
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
    // RATE LIMIT
    // =========================
    const rl = applyRateLimit(request);
    if (rl) return rl;

    // =========================
    // AUTH INJECTION
    // =========================
    let user = null;

    try {
      user = await requireAuth(request, env);
      request.user = user;
    } catch {
      // public routes
    }

    // =========================
    // DISPATCH (O(1))
    // =========================
    const key = `${method} ${path}`;
    const handler = routes[key];

    if (handler) {
      return handler(request, env, user);
    }

    // =========================
    // 404 API
    // =========================
    if (
      path.startsWith("/auth") ||
      path.startsWith("/media") ||
      path.startsWith("/admin") ||
      path.startsWith("/seed")
    ) {
      return json({ error: "Route not found" }, 404);
    }

    // =========================
    // FRONTEND FALLBACK
    // =========================
    return fetch(new Request(new URL("/index.html", request.url)));

  })
};