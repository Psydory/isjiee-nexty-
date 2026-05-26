// =========================
// functions/core/middleware.js
// VERSION CORRIGÉE
// =========================

import { requireAuth, requireAdmin } from "./security.js";
import { ok, badRequest, unauthorized, forbidden, tooManyRequests } from "./errorHandler.js";
import { checkRateLimitWithContext, addRateLimitHeaders } from "./rate-limit.js";

// =========================
// CONFIGURATION PAR ROUTE
// =========================
const ROUTE_CONFIG = {
  "POST /auth/login": { rateLimit: { limit: 5, window: 60000 } },
  "POST /auth/register": { rateLimit: { limit: 3, window: 60000 } },
  "POST /media/upload-url": { rateLimit: { limit: 20, window: 60000 } },
  "default": { rateLimit: { limit: 100, window: 60000 } }
};

function getRouteConfig(path, method) {
  const routeKey = `${method} ${path}`;
  for (const [pattern, config] of Object.entries(ROUTE_CONFIG)) {
    if (routeKey.startsWith(pattern) || pattern === routeKey) {
      return config;
    }
  }
  return ROUTE_CONFIG.default;
}

// =========================
// VALIDATION AVEC SANITIZATION
// =========================
function validateAndSanitize(body, schema) {
  const errors = [];
  const sanitized = {};

  for (const [field, rules] of Object.entries(schema)) {
    let value = body[field];

    if (rules.required && (value === undefined || value === null || value === "")) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }

    if (value !== undefined && value !== null) {
      if (rules.type === "string" && typeof value === "string") {
        value = value.trim();
        if (rules.maxLength) value = value.substring(0, rules.maxLength);
        if (rules.sanitize !== false) value = value.replace(/[<>]/g, "");
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Invalid format for field: ${field}`);
          continue;
        }
      }
      
      if (rules.type === "email" && typeof value === "string") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`Invalid email format for field: ${field}`);
          continue;
        }
        value = value.toLowerCase();
      }
      
      sanitized[field] = value;
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }
  return sanitized;
}

// =========================
// WITH MIDDLEWARE (version corrigée)
// =========================
export function withMiddleware(handler, options = {}) {
  return async (request, env) => {
    const url = new URL(request.url);
    const routeKey = `${request.method} ${url.pathname}`;
    const routeConfig = getRouteConfig(url.pathname, request.method);
    
    try {
      let user = null;

      // 1. AUTH (si requis)
      if (options.auth) {
        try {
          user = await requireAuth(request, env);
          request.user = user;
        } catch {
          return unauthorized();
        }
      }

      // 2. ADMIN CHECK (si requis)
      if (options.admin) {
        try {
          requireAdmin(user);
        } catch {
          return forbidden();
        }
      }

      // 3. RATE LIMITING (avec D1)
      if (options.rateLimit !== false) {
        const rateConfig = routeConfig.rateLimit || { limit: 100, window: 60000 };
        const result = await checkRateLimitWithContext(env, request, user, {
          path: url.pathname,
          method: request.method,
          customLimit: rateConfig.limit,
          customWindow: rateConfig.window
        });
        
        if (!result.allowed) {
          const response = tooManyRequests();
          return addRateLimitHeaders(response, result);
        }
      }

      // 4. BODY PARSING
      let body = {};
      if (request.method !== "GET" && request.method !== "HEAD") {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const rawBody = await request.json().catch(() => ({}));
          body = rawBody;
        }
      }
      request.body = body;

      // 5. VALIDATION (si schéma fourni)
      if (options.validate) {
        body = validateAndSanitize(body, options.validate);
        request.body = body;
      }

      // 6. EXÉCUTION DU HANDLER
      const response = await handler(request, env);
      
      return response;

    } catch (err) {
      console.error("Middleware error:", err.message);
      
      if (err.message.includes("Missing required field") || err.message.includes("Invalid")) {
        return badRequest(err.message);
      }
      
      return badRequest(err.message || "Internal error");
    }
  };
}

// =========================
// EXPORTS UTILITAIRES
// =========================
export { validateAndSanitize as validate };
