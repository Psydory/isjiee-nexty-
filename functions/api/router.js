// =========================
// IMPORTS
// =========================
import { safeHandler, rateLimit, requireAuth } from "../core/security.js";

// AUTH
import { login, refresh, getMe } from "../auth/auth.js";

// SEED
import { seedMedia } from "../modules/seed.js";

// MEDIA
import {
  createUploadUrl,
  validateAndSaveMedia,
  getMediaGallery,
  deleteMedia,
  addView,
  addLike,
  getTrendingMedia,
  getPersonalizedFeed
} from "../modules/media.js";

// ADMIN
import {
  getStats,
  getAllMedia,
  moderateMedia,
  featureMedia,
  getUsers,
  banUser
} from "../modules/admin.js";

// =========================
// HEADERS (CORS)
// =========================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-seed-key",
  "Access-Control-Allow-Methods":
    "GET, POST, PUT, DELETE, OPTIONS"
};

// =========================
// HELPERS
// =========================
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers
  });

// =========================
// RATE LIMIT
// =========================
function applyRateLimit(request) {

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    "unknown";

  if (!rateLimit(`global:${ip}`, 100, 60000)) {
    return json(
      { error: "Too many requests" },
      429
    );
  }

  return null;
}

// =========================
// ADMIN CHECK
// =========================
function requireAdmin(user) {

  if (!user || user.role !== "admin") {
    return json(
      { error: "Forbidden" },
      403
    );
  }

  return null;
}

// =========================
// ROUTES MAP
// =========================
const routes = {

  // =========================
  // HEALTH
  // =========================
  "GET /health": async () =>
    json({
      success: true,
      status: "ok"
    }),

  // =========================
  // AUTH
  // =========================
  "POST /auth/login": (req, env) =>
    login(req, env),

  "POST /auth/refresh": (req, env) =>
    refresh(req, env),

  "GET /auth/me": (req, env) =>
    getMe(req, env),

  // =========================
  // SEED
  // =========================
  "POST /seed/media": async (req, env, user) => {

    const adminCheck = requireAdmin(user);

    if (adminCheck) return adminCheck;

    if (
      req.headers.get("x-seed-key") !==
      env.SEED_KEY
    ) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    return seedMedia(env);
  },

  // =========================
  // ADMIN
  // =========================
  "GET /admin/stats": (req, env, user) => {

    const check = requireAdmin(user);

    if (check) return check;

    return getStats(req, env);
  },

  "GET /admin/media": (req, env, user) => {

    const check = requireAdmin(user);

    if (check) return check;

    return getAllMedia(req, env);
  },

  "POST /admin/media/moderate": (req, env, user) => {

    const check = requireAdmin(user);

    if (check) return check;

    return moderateMedia(req, env);
  },

  "POST /admin/media/feature": (req, env, user) => {

    const check = requireAdmin(user);

    if (check) return check;

    return featureMedia(req, env);
  },

  "GET /admin/users": (req, env, user) => {

    const check = requireAdmin(user);

    if (check) return check;

    return getUsers(req, env);
  },

  "POST /admin/users/ban": (req, env, user) => {

    const check = requireAdmin(user);

    if (check) return check;

    return banUser(req, env);
  },

  // =========================
  // MEDIA
  // =========================
  "GET /media": (req, env) =>
    getMediaGallery(req, env),

  "GET /media/trending": (req, env) =>
    getTrendingMedia(req, env),

  "GET /media/personalized": async (
    req,
    env,
    user
  ) => {

    try {

      req.user = user;

      return getPersonalizedFeed(req, env);

    } catch {

      return getTrendingMedia(req, env);
    }
  },

  "POST /media/upload-url": (
    req,
    env,
    user
  ) => {

    if (!user) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    return createUploadUrl(req, env);
  },

  "POST /media/validate": (
    req,
    env,
    user
  ) => {

    if (!user) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    return validateAndSaveMedia(req, env);
  },

  "POST /media/delete": (
    req,
    env,
    user
  ) => {

    if (!user) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    return deleteMedia(req, env);
  },

  "POST /media/view": (req, env) =>
    addView(req, env),

  "POST /media/like": (
    req,
    env,
    user
  ) => {

    if (!user) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    return addLike(req, env);
  }
};

// =========================
// PAGES FUNCTION ENTRY
// =========================
export const onRequest = safeHandler(
  async (context) => {

    const request = context.request;
    const env = context.env;

    const url = new URL(request.url);

    let path = url.pathname;

    const method = request.method;

    // =========================
    // SUPPORT /api/v1
    // =========================
    if (path.startsWith("/api/v1")) {

      path =
        path.replace("/api/v1", "") || "/";
    }

    // =========================
    // REMOVE /api PREFIX
    // =========================
    if (path.startsWith("/api")) {

      path =
        path.replace("/api", "") || "/";
    }

    // =========================
    // CORS
    // =========================
    if (method === "OPTIONS") {

      return new Response(null, {
        headers
      });
    }

    // =========================
    // RATE LIMIT
    // =========================
    const rl = applyRateLimit(request);

    if (rl) return rl;

    // =========================
    // AUTH
    // =========================
    let user = null;

    try {

      user = await requireAuth(
        request,
        env
      );

    } catch {

      user = null;
    }

    // =========================
    // ROUTE KEY
    // =========================
    const key = `${method} ${path}`;

    const handler = routes[key];

    // =========================
    // ROUTE FOUND
    // =========================
    if (handler) {

      return handler(
        request,
        env,
        user
      );
    }

    // =========================
    // API 404
    // =========================
    if (
      path.startsWith("/auth") ||
      path.startsWith("/media") ||
      path.startsWith("/admin") ||
      path.startsWith("/seed")
    ) {

      return json(
        {
          success: false,
          error: "Route not found"
        },
        404
      );
    }

    // =========================
    // FRONTEND FALLBACK
    // =========================
    return context.next();

  }
);