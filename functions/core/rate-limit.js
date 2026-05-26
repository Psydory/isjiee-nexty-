// =========================
// FONCTION getRouteLimits CORRIGÉE
// =========================
function getRouteLimits(method, path) {
  const routeKey = `${method} ${path}`;
  
  // Vérification exacte
  if (ROUTE_LIMITS[routeKey]) {
    return ROUTE_LIMITS[routeKey];
  }
  
  // Vérification par préfixe
  for (const [pattern, limits] of Object.entries(ROUTE_LIMITS)) {
    if (pattern !== "default" && routeKey.startsWith(pattern)) {
      return limits;
    }
  }
  
  return ROUTE_LIMITS.default;
}

// =========================
// NORMALISATION DES ROUTES CORRIGÉE
// =========================
function normalizePath(path) {
  // Remplacer les UUIDs et IDs numériques par :id
  return path.replace(/\/[a-f0-9-]{36}/gi, '/:id')
             .replace(/\/\d+/g, '/:id')
             .replace(/\/[a-f0-9]{24}/gi, '/:id');
}

// =========================
// GET CLIENT IP CORRIGÉ (sécurisé)
// =========================
export function getClientIP(request) {
  // UNIQUEMENT cf-connecting-ip en production
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  
  // Fallback pour développement
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && (process.env.NODE_ENV === "development" || !cfIp)) {
    return forwarded.split(",")[0].trim();
  }
  
  return "unknown";
}

// =========================
// ADD RATE LIMIT HEADERS CORRIGÉ (immuable)
// =========================
export function addRateLimitHeaders(response, rateLimitResult) {
  if (!rateLimitResult || !response) return response;
  
  // Créer une nouvelle Response pour éviter la mutation
  const newResponse = new Response(response.body, response);
  
  if (rateLimitResult.limit !== undefined) {
    newResponse.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
  }
  if (rateLimitResult.remaining !== undefined) {
    newResponse.headers.set("X-RateLimit-Remaining", String(Math.max(0, rateLimitResult.remaining)));
  }
  if (rateLimitResult.resetAt) {
    newResponse.headers.set("X-RateLimit-Reset", String(Math.ceil(rateLimitResult.resetAt / 1000)));
  }
  
  if (!rateLimitResult.allowed && rateLimitResult.resetAt) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
    newResponse.headers.set("Retry-After", String(Math.max(1, retryAfter)));
  }
  
  return newResponse;
}

// =========================
// CHECK RATE LIMIT D1 CORRIGÉ
// =========================
export async function checkRateLimitD1(env, key, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW) {
  const hashedKey = hashKey(key);
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Nettoyer + Compter + Insérer (3 requêtes mais nécessaire avec D1)
    await env.DB.prepare(`DELETE FROM rate_limits WHERE key = ? AND created_at < ?`)
      .bind(hashedKey, windowStart).run();

    const count = await env.DB.prepare(`SELECT COUNT(*) as total FROM rate_limits WHERE key = ? AND created_at > ?`)
      .bind(hashedKey, windowStart).first();

    const currentCount = count?.total || 0;
    
    if (currentCount >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: windowStart + windowMs,
        type: "d1"
      };
    }

    await env.DB.prepare(`INSERT INTO rate_limits (key, created_at) VALUES (?, ?)`)
      .bind(hashedKey, now).run();

    return {
      allowed: true,
      limit,
      remaining: limit - currentCount - 1,
      resetAt: windowStart + windowMs,
      type: "d1"
    };

  } catch (err) {
    console.error("D1 rate limit error:", err.message);
    return checkRateLimitMemory(key, limit, windowMs);
  }
}

// =========================
// CHECK RATE LIMIT AVEC CONTEXTE CORRIGÉ
// =========================
export async function checkRateLimitWithContext(env, request, user = null, route = null) {
  const ip = getClientIP(request);
  const method = route?.method || request.method;
  let path = route?.path || new URL(request.url).pathname;
  
  // Normaliser le chemin pour les routes dynamiques
  const normalizedPath = normalizePath(path);
  
  // 1. Limite par IP
  const ipKey = `ip:${ip}`;
  const ipResult = await checkRateLimitD1(env, ipKey, 200, 60000);
  if (!ipResult.allowed) {
    return { ...ipResult, context: "ip" };
  }
  
  // 2. Limite par utilisateur
  if (user?.id) {
    const userKey = `user:${user.id}`;
    const userResult = await checkRateLimitD1(env, userKey, 300, 60000);
    if (!userResult.allowed) {
      return { ...userResult, context: "user" };
    }
  }
  
  // 3. Limite par route (normalisée)
  const routeLimits = getRouteLimits(method, normalizedPath);
  const routeKey = `route:${method}:${normalizedPath.replace(/\//g, "_")}:${user?.id || ip}`;
  const routeResult = await checkRateLimitD1(env, routeKey, routeLimits.limit, routeLimits.window);
  if (!routeResult.allowed) {
    return { ...routeResult, context: "route" };
  }
  
  return { allowed: true, context: "ok" };
}
