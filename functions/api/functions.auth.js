// functions/auth/auth-system.js
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ok, badRequest, unauthorized, forbidden, created, conflict, tooManyRequests, withErrorHandler } from "../core/errorHandler.js";
import { checkRateLimitD1 } from "../core/rate-limit.js";

// =========================
// CONFIGURATION & CONSTANTES
// =========================
const ACCESS_EXPIRE = "15m";
const REFRESH_EXPIRE = "7d";
const MAX_EMAIL_LENGTH = 255;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 100;

const ALLOWED_ROLES = ["student", "entrepreneur", "wiggfluenceur", "admin"];
const DEFAULT_ROLE = "student";

// =========================
// VALIDATIONS
// =========================
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  if (email.length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password) {
  if (!password || typeof password !== "string") return false;
  if (password.length < MIN_PASSWORD_LENGTH) return false;
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  // Au moins une majuscule, une minuscule, un chiffre
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  return hasUpper && hasLower && hasDigit;
}

// =========================
// JWT HELPERS
// =========================
function getSecret(env) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

async function generateAccessToken(user, env) {
  const secret = getSecret(env);
  return await new SignJWT({
    id: user.id,
    role: user.role,
    tier: user.tier
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(ACCESS_EXPIRE)
    .sign(secret);
}

async function generateRefreshToken(user, env) {
  const secret = getSecret(env);
  const tokenId = crypto.randomUUID();
  const token = await new SignJWT({
    id: user.id,
    tokenId
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(REFRESH_EXPIRE)
    .sign(secret);
  return { token, tokenId };
}

async function verifyToken(token, env) {
  const secret = getSecret(env);
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

// =========================
// DB HELPERS
// =========================
async function getUserByEmail(env, email) {
  return await env.DB.prepare(`
    SELECT id, email, password, role, banned, tier FROM users WHERE email = ?
  `).bind(email.toLowerCase().trim()).first();
}

async function getUserById(env, id) {
  return await env.DB.prepare(`
    SELECT id, email, role, banned, tier FROM users WHERE id = ?
  `).bind(id).first();
}

async function createUser(env, email, password, role, tier) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const hashedPassword = await bcrypt.hash(password, 10);
  await env.DB.prepare(`
    INSERT INTO users (id, email, password, role, tier, balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(id, email.toLowerCase().trim(), hashedPassword, role, tier, now, now).run();
  return { id, email, role, tier };
}

async function storeRefreshToken(env, userId, tokenId, expiresAt) {
  await env.DB.prepare(`
    INSERT INTO refresh_tokens (token_id, user_id, expires_at, revoked)
    VALUES (?, ?, ?, 0)
  `).bind(tokenId, userId, expiresAt).run();
}

async function revokeRefreshToken(env, tokenId) {
  await env.DB.prepare(`
    UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?
  `).bind(tokenId).run();
}

async function isRefreshTokenRevoked(env, tokenId) {
  const row = await env.DB.prepare(`
    SELECT revoked FROM refresh_tokens WHERE token_id = ?
  `).bind(tokenId).first();
  return row ? row.revoked === 1 : true;
}

// =========================
// REGISTER (corrigé)
// =========================
export const register = withErrorHandler(async (request, env) => {
  const { email, password, role = DEFAULT_ROLE, tier = 1 } = await request.json();

  if (!email) return badRequest("Email required");
  if (!isValidEmail(email)) return badRequest("Invalid email format");
  if (!isValidPassword(password)) {
    return badRequest("Password must be at least 8 characters with uppercase, lowercase and a number");
  }
  if (tier < 1 || tier > 3) return badRequest("Tier must be 1-3");

  // Sécurisation du rôle : seul les rôles autorisés sont acceptés, et on bloque explicitement "admin" à l'inscription
  const safeRole = ALLOWED_ROLES.includes(role) && role !== "admin" ? role : DEFAULT_ROLE;

  const existing = await getUserByEmail(env, email);
  if (existing) return conflict("User already exists");

  const user = await createUser(env, email, password, safeRole, tier);
  const accessToken = await generateAccessToken(user, env);
  const { token: refreshToken, tokenId } = await generateRefreshToken(user, env);
  const expiresAt = Date.now() + 7 * 24 * 3600000;
  await storeRefreshToken(env, user.id, tokenId, expiresAt);

  return created({
    message: "Registration successful",
    user: { id: user.id, email: user.email, role: user.role, tier: user.tier },
    token: accessToken,
    refreshToken
  });
});

// =========================
// LOGIN (avec rate limiting D1 + par email)
// =========================
export const login = withErrorHandler(async (request, env) => {
  const { email, password } = await request.json();
  if (!email) return badRequest("Email required");
  if (!isValidEmail(email)) return badRequest("Invalid email format");
  if (!password) return badRequest("Password required");

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const emailKey = email.toLowerCase().trim();

  // Rate limit par IP + email (5 tentatives par 5 minutes)
  const rateKey = `login:${ip}:${emailKey}`;
  const allowed = await checkRateLimitD1(env, rateKey, 5, 300000);
  if (!allowed.allowed) {
    return tooManyRequests("Too many login attempts. Try again later.");
  }

  const user = await getUserByEmail(env, email);
  if (!user) {
    return unauthorized("Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return unauthorized("Invalid credentials");
  }
  if (user.banned) return forbidden("Account banned");

  // Génération des nouveaux tokens
  const accessToken = await generateAccessToken(user, env);
  const { token: refreshToken, tokenId } = await generateRefreshToken(user, env);
  const expiresAt = Date.now() + 7 * 24 * 3600000;
  await storeRefreshToken(env, user.id, tokenId, expiresAt);

  return ok({
    message: "Login successful",
    user: { id: user.id, email: user.email, role: user.role, tier: user.tier },
    token: accessToken,
    refreshToken
  });
});

// =========================
// REFRESH TOKEN (avec révocation)
// =========================
export const refresh = withErrorHandler(async (request, env) => {
  const { refreshToken } = await request.json();
  if (!refreshToken) return badRequest("Missing refresh token");
  try {
    const payload = await verifyToken(refreshToken, env);
    const { id: userId, tokenId } = payload;
    if (!tokenId) return unauthorized("Invalid token format");
    const revoked = await isRefreshTokenRevoked(env, tokenId);
    if (revoked) return unauthorized("Refresh token revoked");

    const user = await getUserById(env, userId);
    if (!user) return unauthorized("User not found");
    if (user.banned) return forbidden("Account banned");

    // Révocation de l'ancien refresh token
    await revokeRefreshToken(env, tokenId);

    // Génération de nouveaux tokens
    const newAccessToken = await generateAccessToken(user, env);
    const { token: newRefreshToken, tokenId: newTokenId } = await generateRefreshToken(user, env);
    const expiresAt = Date.now() + 7 * 24 * 3600000;
    await storeRefreshToken(env, user.id, newTokenId, expiresAt);

    return ok({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    return unauthorized("Invalid or expired refresh token");
  }
});

// =========================
// LOGOUT (révocation explicite)
// =========================
export const logout = withErrorHandler(async (request, env) => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyToken(token, env);
      if (payload.tokenId) {
        await revokeRefreshToken(env, payload.tokenId);
      }
    } catch {}
  }
  return ok({ message: "Logged out successfully" });
});

// =========================
// GET CURRENT USER
// =========================
export const getMe = withErrorHandler(async (request, env) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return unauthorized();
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, env);
  const user = await getUserById(env, payload.id);
  if (!user) return unauthorized("User not found");
  if (user.banned) return forbidden();
  return ok({ user });
});

// =========================
// MIDDLEWARES
// =========================
export async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, env);
  const user = await getUserById(env, payload.id);
  if (!user || user.banned) throw new Error("Unauthorized");
  return { id: user.id, role: user.role, tier: user.tier };
}

export function requireAdmin(user) {
  if (!user || user.role !== "admin") throw new Error("Forbidden");
}