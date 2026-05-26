// =========================
// functions/core/security.js
// VERSION FINALE - RECRÉÉE SANS RUPTURE
// =========================

// =========================
// IMPORTS
// =========================
// ✅ Import UNIQUE depuis auth-system.js (source de vérité)
import { requireAuth as requireAuthFromAuth, requireAdmin as requireAdminFromAuth } from "../auth/auth-system.js";

// =========================
// CONSTANTES DE SÉCURITÉ
// =========================
const DEFAULT_RATE_LIMIT = 100;
const DEFAULT_RATE_WINDOW = 60000;
const MAX_SANITIZE_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 255;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 100;
const MAX_DEPTH_SANITIZE = 5;

// =========================
// STOCKAGE POUR RATE LIMITING (fallback)
// =========================
const rateLimitCache = new Map();
let cacheCleanupInterval = null;

// =========================
// FONCTIONS UTILITAIRES INTERNES
// =========================

/**
 * Hash simple pour les clés trop longues
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalise une clé pour le rate limiting
 */
function normalizeRateLimitKey(key) {
  if (!key || typeof key !== "string") return "unknown";
  if (key.length > 100) return `h:${simpleHash(key)}`;
  return key;
}

/**
 * Nettoie le cache de rate limiting (appel périodique)
 */
function cleanupRateLimitCache() {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    if (now > entry.resetAt) {
      rateLimitCache.delete(key);
    }
  }
}

// Démarrer le nettoyage automatique si nécessaire
if (typeof global !== "undefined" && !cacheCleanupInterval) {
  cacheCleanupInterval = setInterval(cleanupRateLimitCache, 60000);
}

// =========================
// 1. SAFE HANDLER
// =========================
export function safeHandler(handler) {
  return async (context) => {
    try {
      const result = await handler(context);
      
      if (result instanceof Response) {
        return result;
      }
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
      
    } catch (err) {
      console.error("Handler error:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
      const status = err.status || 500;
      const message = err.message || "Internal server error";
      
      return new Response(JSON.stringify({ success: false, error: message }), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    }
  };
}

// =========================
// 2. REQUIRE AUTH
// =========================
export async function requireAuth(request, env) {
  // Validation des paramètres
  if (!request) {
    throw new Error("Invalid request");
  }
  if (!env || !env.JWT_SECRET) {
    throw new Error("Authentication not configured");
  }
  
  try {
    return await requireAuthFromAuth(request, env);
  } catch (err) {
    // Ne pas exposer les détails internes
    throw new Error("Unauthorized");
  }
}

// =========================
// 3. REQUIRE ADMIN
// =========================
export function requireAdmin(user) {
  if (!user) {
    throw new Error("Unauthorized");
  }
  return requireAdminFromAuth(user);
}

// =========================
// 4. RATE LIMITING (production + fallback)
// =========================
export async function rateLimit(env, key, limit = DEFAULT_RATE_LIMIT, windowMs = DEFAULT_RATE_WINDOW) {
  const normalizedKey = normalizeRateLimitKey(key);
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Tenter d'utiliser D1 si disponible
  if (env?.DB) {
    try {
      await env.DB.prepare(`
        DELETE FROM rate_limits WHERE key = ? AND created_at < ?
      `).bind(normalizedKey, windowStart).run();
      
      const count = await env.DB.prepare(`
        SELECT COUNT(*) as total FROM rate_limits 
        WHERE key = ? AND created_at > ?
      `).bind(normalizedKey, windowStart).first();
      
      if ((count?.total || 0) >= limit) {
        return false;
      }
      
      await env.DB.prepare(`
        INSERT INTO rate_limits (key, created_at) VALUES (?, ?)
      `).bind(normalizedKey, now).run();
      
      return true;
    } catch (err) {
      console.error("D1 rate limit error:", err.message);
      // Fallback vers mémoire
    }
  }
  
  // Fallback mémoire
  let entry = rateLimitCache.get(normalizedKey);
  if (!entry || now > entry.resetAt) {
    rateLimitCache.set(normalizedKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  entry.count++;
  rateLimitCache.set(normalizedKey, entry);
  
  return entry.count <= limit;
}

// =========================
// 5. RATE LIMITING MÉMOIRE (fallback explicite)
// =========================
export function rateLimitMemory(key, limit = DEFAULT_RATE_LIMIT, windowMs = DEFAULT_RATE_WINDOW) {
  const normalizedKey = normalizeRateLimitKey(key);
  const now = Date.now();
  let entry = rateLimitCache.get(normalizedKey);
  
  if (!entry || now > entry.resetAt) {
    rateLimitCache.set(normalizedKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  entry.count++;
  rateLimitCache.set(normalizedKey, entry);
  
  return entry.count <= limit;
}

// =========================
// 6. VALIDATION CHAMPS REQUIS
// =========================
export function validateFields(body, requiredFields = []) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  
  const missing = [];
  for (const field of requiredFields) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
  
  return true;
}

// =========================
// 7. SANITIZATION
// =========================
export function sanitizeInput(input, maxLength = MAX_SANITIZE_LENGTH) {
  if (input === undefined || input === null) return "";
  if (typeof input !== "string") return "";
  
  return input
    .replace(/[<>]/g, "")
    .replace(/&/g, "&amp;")
    .trim()
    .substring(0, maxLength);
}

export function sanitizeObject(obj, maxDepth = MAX_DEPTH_SANITIZE, currentDepth = 0) {
  if (currentDepth > maxDepth) return null;
  if (!obj || typeof obj !== "object") return sanitizeInput(obj);
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth, currentDepth + 1));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeInput(value);
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeObject(value, maxDepth, currentDepth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// =========================
// 8. VALIDATION EMAIL
// =========================
export function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  if (email.length > MAX_EMAIL_LENGTH) return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function sanitizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.toLowerCase().trim();
}

export function validateAndSanitizeEmail(email) {
  const sanitized = sanitizeEmail(email);
  if (!validateEmail(sanitized)) {
    throw new Error("Invalid email format");
  }
  return sanitized;
}

// =========================
// 9. VALIDATION PASSWORD
// =========================
export function validatePassword(password) {
  if (!password || typeof password !== "string") return false;
  if (password.length < MIN_PASSWORD_LENGTH) return false;
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  return true;
}

// =========================
// 10. VALIDATION UUID
// =========================
export function validateUUID(uuid) {
  if (!uuid || typeof uuid !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// =========================
// 11. ESCAPE HTML
// =========================
export function escapeHtml(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =========================
// 12. VALIDATION CONTENT-TYPE
// =========================
export function validateContentType(request, expectedType = "application/json") {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes(expectedType)) {
    throw new Error(`Invalid Content-Type. Expected: ${expectedType}`);
  }
  return true;
}

// =========================
// 13. CLIENT IP SÉCURISÉ
// =========================
export function getClientIP(request) {
  // Cloudflare (production)
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  
  // Développement
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  return "unknown";
}

// =========================
// 14. NETTOYAGE MANUEL DU CACHE
// =========================
export function cleanupRateLimitCacheManually() {
  cleanupRateLimitCache();
}

// =========================
// EXPORTS PRINCIPAUX
// =========================
export default {
  safeHandler,
  requireAuth,
  requireAdmin,
  rateLimit,
  rateLimitMemory,
  cleanupRateLimitCacheManually,
  validateFields,
  sanitizeInput,
  sanitizeObject,
  validateEmail,
  sanitizeEmail,
  validateAndSanitizeEmail,
  validatePassword,
  validateUUID,
  escapeHtml,
  validateContentType,
  getClientIP
};
