// =========================
// functions/api/[[path]].js
// VERSION FINALE - TOUTES CORRECTIONS APPLIQUÉES
// =========================

// =========================
// IMPORTS
// =========================
import { safeHandler, requireAuth, requireAdmin } from "../core/security.js";
import { 
  ok, notFound, unauthorized, forbidden, badRequest, 
  tooManyRequests, created, conflict, withErrorHandler 
} from "../core/errorHandler.js";
import { checkRateLimitWithContext, addRateLimitHeaders, checkRateLimitD1 } from "../core/rate-limit.js";
import { getUserById } from "../core/db.js";

// AUTH
import { login, register, refresh, getMe, logout } from "../auth/auth-system.js";

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

// SEED
import { seedMedia, resetSeed, getSeedStatus } from "../modules/seed.js";

// =========================
// CONSTANTES
// =========================
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
const REQUEST_TIMEOUT_MS = 25000; // 25 secondes

// =========================
// CONFIGURATION CORS
// =========================
const ALLOWED_ORIGINS = [
  "https://isjiee-nexty.pages.dev",
  "http://localhost:8788",
  "http://localhost:3000"
];

function getCorsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-seed-key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
}

// =========================
// ROUTES PUBLIQUES
// =========================
const PUBLIC_ROUTES = new Set([
  "GET /health",
  "GET /media",
  "GET /media/trending",
  "GET /media/featured",
  "POST /media/view",
  "GET /seed/status"
]);

const PUBLIC_ROUTE_PATTERNS = [
  /^GET \/media\/[^/]+$/  // GET /media/:id
];

function isPublicRoute(method, path) {
  const routeKey = `${method} ${path}`;
  if (PUBLIC_ROUTES.has(routeKey)) return true;
  for (const pattern of PUBLIC_ROUTE_PATTERNS) {
    if (pattern.test(routeKey)) return true;
  }
  return false;
}

// =========================
// HELPERS
// =========================

// Add CORS headers sans recréer inutilement la Response
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
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value) newResponse.headers.set(key, value);
  });
  return newResponse;
}

// Timeout avec cleanup
function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Request timeout")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

// Validation des paramètres ID
function validateParamId(value) {
  if (!value || typeof value !== "string") return false;
  if (value.length > 100) return false;
  if (!/^[a-zA-Z0-9\-_]+$/.test(value)) return false;
  return true;
}

// Vérification taille payload
function checkPayloadSize(request) {
  const contentLength = parseInt(request.headers.get("content-length") || "0");
  const method = request.method;
  
  if (method !== "GET" && method !== "HEAD" && contentLength > MAX_PAYLOAD_SIZE) {
    throw new Error(`Payload too large (max ${MAX_PAYLOAD_SIZE} bytes)`);
  }
  return true;
}

// =========================
// ADMIN WRAPPER (avec logging)
// =========================
function adminHandler(handler) {
  return async (req, env, user) => {
    try {
      requireAdmin(user);
      console.log(`[ADMIN] ${user.id} - ${handler.name || 'action'}`);
      const response = await handler(req, env);
      return addCors(response, req);
    } catch (err) {
      console.error(`[ADMIN] Forbidden: ${user?.id} - ${err.message}`);
      return addCors(forbidden(err.message), req);
    }
  };
}

// =========================
// AUTH WRAPPER (avec vérification DB)
// =========================
function authHandler(handler) {
  return async (req, env, user) => {
    if (!user) return addCors(unauthorized(), req);
    
    // Vérifier que l'utilisateur existe toujours en DB
    const dbUser = await getUserById(env, user.id);
    if (!dbUser || dbUser.banned) {
      console.warn(`[AUTH] Invalid user: ${user.id} - ${!dbUser ? 'not found' : 'banned'}`);
      return addCors(unauthorized("User not found or banned"), req);
    }
    
    const response = await handler(req, env, user);
    return addCors(response, req);
  };
}

// =========================
// RATE LIMIT WRAPPER (corrigé)
// =========================
function rateLimitHandler(handler, options = {}) {
  return async (req, env, user) => {
    const { limit = 10, window = 60000 } = options;
    const url = new URL(req.url);
    const key = `rl:${url.pathname}:${user?.id || req.headers.get("cf-connecting-ip")}`;
    
    const rateResult = await checkRateLimitD1(env, key, limit, window);
    
    if (!rateResult.allowed) {
      const response = tooManyRequests();
      response.headers.set("X-RateLimit-Limit", String(rateResult.limit));
      response.headers.set("X-RateLimit-Remaining", String(rateResult.remaining));
      response.headers.set("X-RateLimit-Reset", String(Math.ceil(rateResult.resetAt / 1000)));
      return addCors(response, req);
    }
    
    const response = await handler(req, env, user);
    return addCors(response, req);
  };
}

// =========================
// ROUTES MAP (complète)
// =========================
const routes = {
  // ===== HEALTH =====
  "GET /health": async (req, env) => addCors(ok({ status: "ok", timestamp: Date.now() }), req),

  // ===== AUTH =====
  "POST /auth/login": async (req, env) => addCors(await login(req, env), req),
  "POST /auth/register": rateLimitHandler(async (req, env) => addCors(await register(req, env), req), { limit: 3, window: 60000 }),
  "POST /auth/refresh": async (req, env) => addCors(await refresh(req, env), req),
  "GET /auth/me": async (req, env, user) => {
    if (!user) return addCors(unauthorized(), req);
    return addCors(await getMe(req, env), req);
  },
  "POST /auth/logout": async (req, env) => addCors(await logout(req, env), req),

  // ===== USER PROFILE =====
  "GET /user/profile": async (req, env, user) => {
    if (!user) return addCors(unauthorized(), req);
    return addCors(await getProfile(req, env, user), req);
  },
  "PUT /user/profile": rateLimitHandler(async (req, env, user) => {
    if (!user) return addCors(unauthorized(), req);
    return addCors(await updateProfile(req, env, user), req);
  }, { limit: 5, window: 60000 }),

  // ===== ADMIN =====
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

  // ===== SEED =====
  "POST /seed/media": adminHandler(seedMedia),
  "POST /seed/reset": adminHandler(resetSeed),
  "GET /seed/status": async (req, env) => addCors(await getSeedStatus(req, env), req),

  // ===== MEDIA (publiques) =====
  "GET /media": async (req, env, user) => addCors(await getMediaGallery(req, env, user), req),
  "GET /media/trending": async (req, env) => addCors(await getTrendingMedia(req, env), req),
  "GET /media/featured": async (req, env) => addCors(await getFeaturedMedia(req, env), req),
  "GET /media/user": async (req, env) => addCors(await getMediaByUser(req, env), req),
  "GET /media/:id": async (req, env, user) => addCors(await getMediaById(req, env, user), req),
  "POST /media/view": async (req, env) => addCors(await addView(req, env), req),

  // ===== MEDIA (protégées) =====
  "GET /media/personalized": async (req, env, user) => {
    if (!user) return addCors(await getTrendingMedia(req, env), req);
    return addCors(await getPersonalizedFeed(req, env, user), req);
  },
  "POST /media/upload-url": rateLimitHandler(authHandler(createUploadUrl), { limit: 10, window: 60000 }),
  "POST /media/validate": rateLimitHandler(authHandler(validateAndSaveMedia), { limit: 20, window: 60000 }),
  "PUT /media/update": authHandler(updateMedia),
  "DELETE /media": authHandler(deleteMedia),
  "POST /media/like": rateLimitHandler(authHandler(addLike), { limit: 30, window: 60000 }),
  "POST /media/unlike": authHandler(removeLike)
};

// =========================
// CLEAN PATH
// =========================
function cleanPath(path) {
  if (path.startsWith("/api")) {
    return path.replace(/^\/api(?:\/v1)?/, "") || "/";
  }
  return path;
}

// =========================
// ROUTE MATCHING
// =========================
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
// MAIN HANDLER
// =========================
export const onRequest = safeHandler(async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method;
  let path = cleanPath(url.pathname);
  const startTime = Date.now();

  // ===== 1. CORS OPTIONS =====
  if (method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(request) });
  }

  // ===== 2. VÉRIFICATION TAILLE PAYLOAD =====
  try {
    checkPayloadSize(request);
  } catch (err) {
    return addCors(badRequest(err.message), request);
  }

  // ===== 3. AUTH (d'abord pour avoir user pour rate limiting) =====
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

  // ===== 4. RATE LIMITING GLOBAL =====
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const globalKey = `global:${ip}:${user?.id || 'anon'}`;
  const globalRateResult = await checkRateLimitD1(env, globalKey, 200, 60000);
  
  if (!globalRateResult.allowed) {
    const response = tooManyRequests();
    response.headers.set("X-RateLimit-Limit", String(globalRateResult.limit));
    response.headers.set("X-RateLimit-Remaining", String(globalRateResult.remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(globalRateResult.resetAt / 1000)));
    return addCors(response, request);
  }

  // ===== 5. VÉRIFICATION AUTH POUR ROUTES PROTÉGÉES =====
  if (!publicRoute && !user) {
    return addCors(unauthorized(authError || "Unauthorized"), request);
  }

  // ===== 6. ROUTE MATCHING =====
  const matched = matchRoute(method, path, routes);
  
  if (matched) {
    request.params = matched.params;
    
    try {
      const response = await withTimeout(matched.handler(request, env, user));
      const duration = Date.now() - startTime;
      
      // Log optionnel (décommenter si table api_logs existe)
      if (env.LOG_API === "true") {
        await env.DB.prepare(`
          INSERT INTO api_logs (method, path, user_id, status, duration, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(method, path, user?.id || null, response.status, duration, Date.now()).run().catch(() => {});
      }
      
      return addCors(response, request);
    } catch (err) {
      if (err.message === "Request timeout") {
        console.error(`[TIMEOUT] ${method} ${path} - ${duration}ms`);
        return addCors(tooManyRequests("Request timeout"), request);
      }
      throw err;
    }
  }

  // ===== 7. 404 POUR ROUTES API =====
  if (path.startsWith("/auth") || path.startsWith("/media") || 
      path.startsWith("/admin") || path.startsWith("/seed") ||
      path.startsWith("/user")) {
    return addCors(notFound("Route not found"), request);
  }

  // ===== 8. FRONTEND FALLBACK =====
  return next();
});