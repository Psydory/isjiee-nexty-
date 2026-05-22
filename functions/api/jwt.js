// =========================
// functions/core/jwt.js
// VERSION FINALE AUTO-CORRIGÉE
// =========================

// =========================
// BASE64 URL SAFE (avec support Unicode)
// =========================
function base64urlEncode(input) {
  let str = typeof input === "string" ? input : JSON.stringify(input);
  // Encoder les caractères Unicode pour btoa
  str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => 
    String.fromCharCode(parseInt(p1, 16))
  );
  return btoa(str)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecodeToString(input) {
  if (!input || input === "") return "";
  let decoded = input.replace(/-/g, "+").replace(/_/g, "/");
  while (decoded.length % 4) decoded += "=";
  const binary = atob(decoded);
  // Décoder les caractères Unicode
  return decodeURIComponent(
    binary.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
}

function base64urlDecodeToObject(input) {
  const decoded = base64urlDecodeToString(input);
  try {
    return JSON.parse(decoded);
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

// =========================
// TIMING SAFE COMPARE (robuste)
// =========================
function timingSafeEqual(a, b) {
  const strA = String(a === undefined ? "" : a);
  const strB = String(b === undefined ? "" : b);
  if (strA.length !== strB.length) return false;
  let result = 0;
  for (let i = 0; i < strA.length; i++) {
    result |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return result === 0;
}

// =========================
// VALIDATION SECRET (strict)
// =========================
function validateSecret(secret) {
  if (!secret || typeof secret !== "string") {
    throw new Error("JWT_SECRET is not defined");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return true;
}

// =========================
// HMAC SIGN (avec validation)
// =========================
async function hmacSign(data, secret) {
  if (!data || typeof data !== "string") {
    throw new Error("Invalid data for HMAC signing");
  }
  validateSecret(secret);
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// =========================
// VERIFIER HEADER
// =========================
function verifyHeader(headerBase) {
  const header = base64urlDecodeToObject(headerBase);
  if (header.alg !== "HS256") {
    throw new Error(`Unsupported algorithm: ${header.alg || "none"}`);
  }
  if (header.typ && header.typ !== "JWT") {
    throw new Error(`Invalid token type: ${header.typ}`);
  }
  return true;
}

// =========================
// CREATE JWT
// =========================
export async function createJWT(payload, secret, expiresIn = 86400) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload for JWT");
  }
  validateSecret(secret);
  
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };
  
  const headerBase = base64urlEncode(header);
  const payloadBase = base64urlEncode(fullPayload);
  const unsigned = `${headerBase}.${payloadBase}`;
  const signature = await hmacSign(unsigned, secret);
  
  return `${unsigned}.${signature}`;
}

// =========================
// VERIFY JWT (complète)
// =========================
export async function verifyJWT(token, secret) {
  validateSecret(secret);
  
  if (!token || typeof token !== "string") {
    throw new Error("Missing or invalid token");
  }
  
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format: expected 3 parts");
  }
  
  const [headerBase, payloadBase, signature] = parts;
  
  // Vérifier l'en-tête
  verifyHeader(headerBase);
  
  // Vérifier la signature (timing safe)
  const unsigned = `${headerBase}.${payloadBase}`;
  const expectedSignature = await hmacSign(unsigned, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error("Invalid token signature");
  }
  
  // Décoder et vérifier le payload
  const payload = base64urlDecodeToObject(payloadBase);
  const now = Math.floor(Date.now() / 1000);
  
  // Vérifier expiration
  const exp = Number(payload.exp);
  if (!isNaN(exp) && exp < now) {
    throw new Error("Token expired");
  }
  
  // Vérifier issued at (tolérance 60s)
  const iat = Number(payload.iat);
  if (!isNaN(iat) && iat > now + 60) {
    throw new Error("Token issued in the future");
  }
  
  return payload;
}

// =========================
// COMPATIBILITY EXPORTS
// =========================
export const sign = createJWT;
export const verify = verifyJWT;

// =========================
// REQUIRE AUTH JWT
// =========================
export async function requireAuthJWT(request, secret) {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }
  
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Invalid authorization format: expected Bearer token");
  }
  
  const token = authHeader.substring(7);
  if (!token) {
    throw new Error("Empty token");
  }
  
  const payload = await verifyJWT(token, secret);
  
  // Vérifier que le payload contient les champs requis
  if (!payload.id) {
    throw new Error("Invalid token payload: missing id");
  }
  
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role || "user",
    iat: payload.iat,
    exp: payload.exp
  };
}

// =========================
// GET USER FROM REQUEST (utilitaire)
// =========================
export async function getUserFromRequest(request, env) {
  try {
    return await requireAuthJWT(request, env.JWT_SECRET);
  } catch {
    return null;
  }
}