// =========================
// functions/api/core/request.js
// VERSION AUTO-CORRIGÉE
// =========================

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const MAX_STRING_LENGTH = 5000;
const MAX_DEPTH = 20;
const MAX_KEYS = 100;

// =========================
// ESCAPE HTML (conserve les données)
// =========================
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =========================
// SANITIZE BODY (sans destruction)
// =========================
function sanitizeBody(body, depth = 0) {
  if (depth > MAX_DEPTH) return body;
  
  if (body === null || body === undefined) return body;
  
  if (typeof body === "string") {
    return escapeHtml(body.trim()).substring(0, MAX_STRING_LENGTH);
  }
  
  if (typeof body === "number") {
    return isFinite(body) ? body : 0;
  }
  
  if (Array.isArray(body)) {
    return body.slice(0, MAX_KEYS).map(item => sanitizeBody(item, depth + 1));
  }
  
  if (typeof body === "object") {
    const sanitized = {};
    let count = 0;
    
    for (const [key, value] of Object.entries(body)) {
      if (count >= MAX_KEYS) break;
      if (typeof key === "string" && key.length < 100) {
        sanitized[key] = sanitizeBody(value, depth + 1);
        count++;
      }
    }
    return sanitized;
  }
  
  return body;
}

// =========================
// PARSE JSON BODY AVEC VALIDATION
// =========================
export async function parseBody(request, env, options = {}) {
  const { maxSize = MAX_BODY_SIZE, required = false } = options;
  
  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }
  
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (required) throw new Error("Content-Type must be application/json");
    return {};
  }
  
  const contentLength = parseInt(request.headers.get("content-length") || "0");
  if (contentLength > maxSize) {
    throw new Error(`Request body too large (max ${maxSize} bytes)`);
  }
  
  try {
    const body = await request.json();
    return sanitizeBody(body);
  } catch (err) {
    if (required) throw new Error("Invalid JSON body");
    return {};
  }
}

// =========================
// GET CLIENT IP (sécurisé)
// =========================
export function getClientIP(request, env = {}) {
  // En production, se fier uniquement à Cloudflare
  if (env.ENVIRONMENT === "production") {
    return request.headers.get("cf-connecting-ip") || "unknown";
  }
  
  // En développement
  return request.headers.get("cf-connecting-ip") ||
         request.headers.get("x-forwarded-for")?.split(",")[0] ||
         "127.0.0.1";
}

// =========================
// GET USER AGENT
// =========================
export function getUserAgent(request) {
  const ua = request.headers.get("user-agent");
  if (!ua || ua.length > 500) return "unknown";
  return ua.substring(0, 500);
}

// =========================
// IS AJAX REQUEST
// =========================
export function isAjaxRequest(request) {
  return request.headers.get("x-requested-with") === "XMLHttpRequest" ||
         request.headers.get("accept")?.includes("application/json") ||
         false;
}

// =========================
// GET AUTH TOKEN
// =========================
export function getAuthToken(request) {
  const auth = request.headers.get("authorization");
  if (!auth || typeof auth !== "string") return null;
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.substring(7);
  if (!token || token.length > 5000) return null;
  return token;
}
