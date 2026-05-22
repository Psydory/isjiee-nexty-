// =========================
// functions/api/[[path]].js
// ROUTEUR PRINCIPAL – VERSION FINALE SÉCURISÉE
// =========================

import { safeHandler } from "../core/security.js";
import { ok, notFound, unauthorized, forbidden, badRequest, tooManyRequests } from "../core/errorHandler.js";
import { addRateLimitHeaders, checkRateLimitD1 } from "../core/rate-limit.js";
import { getUserById } from "../core/db.js";

// ✅ Correction 1 : Importer auth depuis auth-system.js uniquement
import { requireAuth, requireAdmin, login, register, refresh, getMe, logout } from "../auth/auth-system.js";

// USER
import { getProfile, updateProfile } from "../auth/user-controller.js";

// MEDIA
import {
  createUploadUrl,
  validateAndSaveMedia,
  getMediaGallery,
  getMediaById,
  deleteMedia,
  addView,
  addLike,
  removeLike,
  getTrendingMedia,
  getPersonalizedFeed,
  updateMedia,
  getMediaByUser,
  getFeaturedMedia
} from "../modules/media.js";

// ADMIN
import {
  getStats,
  getAllMedia,
  getMediaById as adminGetMediaById,
  moderateMedia,
  featureMedia,
  deleteMedia as adminDeleteMedia,
  getUsers,
  getUserById as adminGetUserById,
  banUser,
  updateUserRole
} from "../modules/admin.js";

// EARN
import { earn, getUserEarnings, getUserBalance, getEarningsStats } from "../modules/earn.js";

// LEVEL
import { getLevelInfo, getLeaderboard, getPointsStats } from "../modules/level.js";

// SUBSCRIPTION
import {
  getSubscriptionStatus,
  renewSubscription,
  cancelSubscription,
  reactivateSubscription,
  getAllSubscriptions,
  getSubscriptionStats,
  cleanupExpiredSubscriptions
} from "../modules/subscription.js";

// TASKS
import { getTasks, submitTask, getTaskById, validateTask, getAllTasks } from "../modules/task-module.js";

// PROJECTS
import {
  createProject,
  getUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getAllProjects
} from "../modules/project-mobiles.js";

// STUDENT
import { getStudentDashboard, getStudentProgress, getStudentRanking } from "../modules/student-module.js";

// SEED
import { seedMedia, resetSeed, getSeedStatus } from "../modules/seed.js";

// PASSWORD RESET
import { requestPasswordReset, resetPassword } from "../modules/password.js";

// =========================
// CONSTANTES & HELPERS
// =========================
const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 25000;
const ALLOWED_ORIGINS = [
  "https://isjiee-nexty.pages.dev",
  "http://localhost:8788",
  "http://localhost:3000"
  // Pour les previews Cloudflare, on pourrait ajouter une vérification dynamique
];

function getCorsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  // ✅ Accepte également les sous-domaines .pages.dev (optionnel)
  const isPreview = origin.endsWith(".pages.dev");
  const allowed = isAllowed || isPreview;
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-seed-key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
}

// ✅ Ajout des headers de sécurité
function addSecurityHeaders(response) {
  if (!response) return response;
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // On pourrait ajouter CSP plus tard
  return response;
}

function addCors(response, request) {
  if (!response) return response;
  const corsHeaders = getCorsHeaders(request);
  let needsUpdate = false;
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (response.headers.get(key) !== value) {
      needsUpdate = true;
      break;
    }
  }
  if (!needsUpdate) return response;
  const newResponse = new Response(response.body, response);
  Object.entries(corsHeaders).forEach(([k, v]) => {
    if (v) newResponse.headers.set(k, v);
  });
  return addSecurityHeaders(newResponse);
}

function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Request timeout")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function validateParamId(value) {
  if (!value || typeof value !== "string") return false;
  if (value.length > 100) return false;
  if (!/^[a-zA-Z0-9\-_]+$/.test(value)) return false;
  return true;
}

function checkPayloadSize(request) {
  const contentLength = parseInt(request.headers.get("content-length") || "0");
  const method = request.method;
  if (method !== "GET" && method !== "HEAD" && contentLength > MAX_PAYLOAD_SIZE) {
    throw new Error(`Payload too large (max ${MAX_PAYLOAD_SIZE} bytes)`);
  }
  return true;
}

// =========================
// WRAPPERS (sans addCors à l'intérieur)
// =========================
function adminHandler(handler) {
  return async (req, env, user) => {
    try {
      requireAdmin(user);
      console.log(`[ADMIN] ${user.id} - ${handler.name || 'action'}`);
      return await handler(req, env, user);
    } catch (err) {
      console.error(`[ADMIN] Forbidden: ${user?.id} - ${err.message}`);
      return forbidden(err.message);
    }
  };
}

function authHandler(handler) {
  return async (req, env, user) => {
    if (!user) return unauthorized();
    const dbUser = await getUserById(env, user.id);
    if (!dbUser || dbUser.banned) {
      console.warn(`[AUTH] Invalid user: ${user.id} - ${!dbUser ? 'not found' : 'banned'}`);
      return unauthorized("User not found or banned");
    }
    return await handler(req, env, user);
  };
}

function rateLimitHandler(handler, options = {}) {
  return async (req, env, user) => {
    const { limit = 10, window = 60000 } = options;
    const url = new URL(req.url);
    const clientIp = req.headers.get("cf-connecting-ip") || "unknown";
    const key = `rl:${url.pathname}:${user?.id || clientIp}`;
    const rateResult = await checkRateLimitD1(env, key, limit, window);
    if (!rateResult.allowed) {
      const response = tooManyRequests();
      addRateLimitHeaders(response, rateResult);
      return response;
    }
    return await handler(req, env, user);
  };
}

// =========================
// ROUTES PUBLIQUES (sans /level/info, car elle nécessite l'utilisateur)
// =========================
const PUBLIC_ROUTES = new Set([
  "GET /health",
  "GET /media",
  "GET /media/trending",
  "GET /media/featured",
  "POST /media/view",
  "GET /seed/status",
  "GET /leaderboard",
  "POST /auth/forgot-password",
  "POST /auth/reset-password"
]);

const PUBLIC_ROUTE_PATTERNS = [
  /^GET \/media\/[a-zA-Z0-9\-_]+$/  // GET /media/:id
];

function isPublicRoute(method, path) {
  const routeKey = `${method} ${path}`;
  if (PUBLIC_ROUTES.has(routeKey)) return true;
  const reserved = ["/media/user", "/media/trending", "/media/featured"];
  if (reserved.includes(path)) return false;
  for (const pattern of PUBLIC_ROUTE_PATTERNS) {
    if (pattern.test(routeKey)) return true;
  }
  return false;
}

// =========================
// ROUTES MAP – sans addCors à l'intérieur, sans doublons
// =========================
const routes = {
  // Health
  "GET /health": async () => ok({ status: "ok", timestamp: Date.now() }),

  // Auth
  "POST /auth/login": async (req, env) => login(req, env),
  "POST /auth/register": rateLimitHandler(async (req, env) => register(req, env), { limit: 3, window: 60000 }),
  "POST /auth/refresh": async (req, env) => refresh(req, env),
  "GET /auth/me": async (req, env, user) => {
    if (!user) return unauthorized();
    return getMe(req, env);
  },
  "POST /auth/logout": authHandler(logout),

  // Password reset (avec rate limit)
  "POST /auth/forgot-password": rateLimitHandler(async (req, env) => requestPasswordReset(req, env), { limit: 3, window: 300000 }),
  "POST /auth/reset-password": rateLimitHandler(async (req, env) => resetPassword(req, env), { limit: 5, window: 300000 }),

  // User profile
  "GET /user/profile": authHandler(getProfile),
  "PUT /user/profile": rateLimitHandler(authHandler(updateProfile), { limit: 5, window: 60000 }),

  // Admin
  "GET /admin/stats": adminHandler(getStats),
  "GET /admin/media": adminHandler(getAllMedia),
  "GET /admin/media/:id": adminHandler(adminGetMediaById),
  "POST /admin/media/moderate": adminHandler(moderateMedia),
  "POST /admin/media/feature": adminHandler(featureMedia),
  "DELETE /admin/media": adminHandler(adminDeleteMedia),
  "GET /admin/users": adminHandler(getUsers),
  "GET /admin/users/:id": adminHandler(adminGetUserById),
  "POST /admin/users/ban": adminHandler(banUser),
  "PUT /admin/users/role": adminHandler(updateUserRole),
  "GET /admin/earnings/stats": adminHandler(getEarningsStats),
  "GET /admin/points/stats": adminHandler(getPointsStats),
  "GET /admin/subscriptions": adminHandler(getAllSubscriptions),
  "GET /admin/subscription/stats": adminHandler(getSubscriptionStats),
  "POST /admin/subscription/cleanup": adminHandler(cleanupExpiredSubscriptions),
  "GET /admin/tasks": adminHandler(getAllTasks),
  "POST /admin/task/validate": adminHandler(validateTask),  // ✅ un seul exemplaire
  "GET /admin/projects": adminHandler(getAllProjects),
  "GET /admin/student/ranking": adminHandler(getStudentRanking),

  // Seed (bloqué hors développement)
  "POST /seed/media": async (req, env, user) => {
    if (env.ENVIRONMENT !== "development") return forbidden("Seed only in development");
    return adminHandler(seedMedia)(req, env, user);
  },
  "POST /seed/reset": async (req, env, user) => {
    if (env.ENVIRONMENT !== "development") return forbidden("Seed only in development");
    return adminHandler(resetSeed)(req, env, user);
  },
  "GET /seed/status": async (req, env) => getSeedStatus(req, env),

  // Media publiques
  "GET /media": async (req, env, user) => getMediaGallery(req, env, user),
  "GET /media/trending": async (req, env) => getTrendingMedia(req, env),
  "GET /media/featured": async (req, env) => getFeaturedMedia(req, env),
  "GET /media/user": authHandler(async (req, env, user) => getMediaByUser(req, env)),
  "GET /media/:id": async (req, env, user) => getMediaById(req, env, user),
  "POST /media/view": async (req, env) => addView(req, env),
  "GET /media/personalized": authHandler(async (req, env, user) => getPersonalizedFeed(req, env, user)),

  // Media protégées
  "POST /media/upload-url": rateLimitHandler(authHandler(createUploadUrl), { limit: 10, window: 60000 }),
  "POST /media/validate": rateLimitHandler(authHandler(validateAndSaveMedia), { limit: 20, window: 60000 }),
  "PUT /media/update": authHandler(updateMedia),
  "DELETE /media": authHandler(deleteMedia),
  "POST /media/like": rateLimitHandler(authHandler(addLike), { limit: 30, window: 60000 }),
  "POST /media/unlike": authHandler(removeLike),

  // Earn
  "POST /earn": authHandler(earn),
  "GET /earn/history": authHandler(getUserEarnings),
  "GET /balance": authHandler(getUserBalance),

  // Level & leaderboard (level info n'est pas publique, donc pas dans PUBLIC_ROUTES)
  "GET /level/info": authHandler(getLevelInfo),
  "GET /leaderboard": async (req, env, user) => getLeaderboard(req, env, user),

  // Subscription
  "GET /subscription/status": authHandler(getSubscriptionStatus),
  "POST /subscription/renew": authHandler(renewSubscription),
  "POST /subscription/cancel": authHandler(cancelSubscription),
  "POST /subscription/reactivate": authHandler(reactivateSubscription),

  // Tasks (RESTful)
  "GET /tasks": authHandler(getTasks),
  "GET /tasks/:id": authHandler(getTaskById),
  "POST /tasks": rateLimitHandler(authHandler(submitTask), { limit: 10, window: 60000 }),

  // Projects (RESTful)
  "GET /projects": authHandler(getUserProjects),
  "GET /projects/:id": authHandler(getProjectById),
  "POST /projects": authHandler(createProject),
  "PUT /projects/:id": authHandler(updateProject),
  "DELETE /projects/:id": authHandler(deleteProject),

  // Student
  "GET /student/dashboard": authHandler(getStudentDashboard),
  "GET /student/progress": authHandler(getStudentProgress)
};

// =========================
// CLEAN PATH & ROUTE MATCHING
// =========================
function cleanPath(path) {
  if (path.startsWith("/api")) {
    return path.replace(/^\/api(?:\/v1)?/, "") || "/";
  }
  return path;
}

function matchRoute(method, path, routes) {
  const exactKey = `${method} ${path}`;
  if (routes[exactKey]) {
    return { handler: routes[exactKey], params: {} };
  }
  for (const [pattern, handler] of Object.entries(routes)) {
    const [patternMethod, ...patternParts] = pattern.split(" ");
    const patternPath = patternParts.join(" ");
    if (patternMethod !== method) continue;
    const patternSegments = patternPath.split("/");
    const pathSegments = path.split("/");
    if (patternSegments.length !== pathSegments.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const patternSeg = patternSegments[i];
      const pathSeg = pathSegments[i];
      if (patternSeg.startsWith(":")) {
        const paramName = patternSeg.slice(1);
        if (paramName === "id" && !validateParamId(pathSeg)) {
          match = false;
          break;
        }
        params[paramName] = decodeURIComponent(pathSeg);
      } else if (patternSeg !== pathSeg) {
        match = false;
        break;
      }
    }
    if (match) {
      return { handler, params };
    }
  }
  return null;
}

// =========================
// GATEWAY TIMEOUT (504)
// =========================
function gatewayTimeout(message = "Request timeout") {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 504,
    headers: { "Content-Type": "application/json" }
  });
}

// =========================
// MAIN HANDLER
// =========================
export const onRequest = safeHandler(async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method;
  let path = cleanPath(url.pathname);
  const startTime = Date.now();

  if (method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(request) });
  }

  try {
    checkPayloadSize(request);
  } catch (err) {
    return addCors(badRequest(err.message), request);
  }

  let user = null;
  let authError = null;
  const publicRoute = isPublicRoute(method, path);

  if (!publicRoute) {
    try {
      user = await requireAuth(request, env);
    } catch (err) {
      authError = err.message;
      user = null;
    }
  }

  // Rate limiting global
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const globalKey = `global:${ip}:${user?.id || 'anon'}`;
  const globalRateResult = await checkRateLimitD1(env, globalKey, 200, 60000);
  if (!globalRateResult.allowed) {
    const response = tooManyRequests();
    addRateLimitHeaders(response, globalRateResult);
    return addCors(response, request);
  }

  if (!publicRoute && !user) {
    return addCors(unauthorized(authError || "Unauthorized"), request);
  }

  const matched = matchRoute(method, path, routes);
  if (matched) {
    // ✅ Correction 2 : ne pas muter request, créer un nouveau contexte
    const ctx = {
      request,
      env,
      user,
      params: matched.params
    };
    try {
      let response = await withTimeout(matched.handler(ctx.request, ctx.env, ctx.user, ctx.params));
      // Si le handler a utilisé des paramètres via ctx.params, on pourrait les passer autrement,
      // mais ici on suppose que les handlers lisent les paramètres depuis l'URL (new URL(req.url)).
      // On garde la compatibilité.
      const duration = Date.now() - startTime;
      if (env.LOG_API === "true") {
        await env.DB.prepare(`INSERT INTO api_logs (method, path, user_id, status, duration, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(method, path, user?.id || null, response.status, duration, Date.now()).run().catch(() => {});
      }
      return addCors(response, request);
    } catch (err) {
      const duration = Date.now() - startTime;
      if (err.message === "Request timeout") {
        console.error(`[TIMEOUT] ${method} ${path} - ${duration}ms`);
        return addCors(gatewayTimeout("Request timeout"), request);
      }
      throw err;
    }
  }

  // ✅ Correction 3 : vérifier les nouvelles routes RESTful
  if (path.startsWith("/auth") || path.startsWith("/media") || path.startsWith("/admin") ||
      path.startsWith("/seed") || path.startsWith("/user") || path.startsWith("/earn") ||
      path.startsWith("/level") || path.startsWith("/subscription") || path.startsWith("/tasks") ||
      path.startsWith("/projects") || path.startsWith("/student")) {
    return addCors(notFound("Route not found"), request);
  }

  return next();
});