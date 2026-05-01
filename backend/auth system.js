// =========================
// IMPORTS
// =========================
import { SignJWT, jwtVerify } from "jose";

// =========================
// CONFIG
// =========================
const ACCESS_EXPIRE = "15m";
const REFRESH_EXPIRE = "7d";

// =========================
// HEADERS GLOBAL (CORS)
// =========================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

// =========================
// TOKEN GENERATION
// =========================
async function generateAccessToken(user, env) {
  const SECRET = new TextEncoder().encode(env.JWT_SECRET);

  return await new SignJWT({
    id: user.id,
    role: user.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(ACCESS_EXPIRE)
    .sign(SECRET);
}

async function generateRefreshToken(user, env) {
  const SECRET = new TextEncoder().encode(env.JWT_SECRET);

  return await new SignJWT({
    id: user.id
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(REFRESH_EXPIRE)
    .sign(SECRET);
}

// =========================
// VERIFY TOKEN
// =========================
async function verifyToken(token, env) {
  const SECRET = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jwtVerify(token, SECRET);
  return payload;
}

// =========================
// LOGIN
// =========================
export async function login(request, env) {

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const { email, password } = await request.json();

  const user = await env.DB.prepare(
    `SELECT * FROM users WHERE email = ?`
  ).bind(email).first();

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 401, headers });
  }

  // ⚠️ TEMPORAIRE (à remplacer par hash)
  if (user.password !== password) {
    return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401, headers });
  }

  if (user.banned) {
    return new Response(JSON.stringify({ error: "User banned" }), { status: 403, headers });
  }

  const token = await generateAccessToken(user, env);
  const refreshToken = await generateRefreshToken(user, env);

  return new Response(JSON.stringify({
    token,
    refreshToken,
    user: {
      id: user.id,
      role: user.role
    }
  }), { headers });
}

// =========================
// REFRESH TOKEN
// =========================
export async function refresh(request, env) {

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const { refreshToken } = await request.json();

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: "Missing refresh token" }), { status: 400, headers });
  }

  try {

    const payload = await verifyToken(refreshToken, env);

    const newToken = await generateAccessToken(payload, env);
    const newRefresh = await generateRefreshToken(payload, env);

    return new Response(JSON.stringify({
      token: newToken,
      refreshToken: newRefresh
    }), { headers });

  } catch {
    return new Response(JSON.stringify({ error: "Invalid refresh token" }), { status: 401, headers });
  }
}

// =========================
// AUTH MIDDLEWARE
// =========================
export async function requireAuth(request, env) {

  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");

  try {

    const payload = await verifyToken(token, env);

    return {
      id: payload.id,
      role: payload.role
    };

  } catch {
    throw new Error("Invalid token");
  }
}

// =========================
// ADMIN MIDDLEWARE
// =========================
export function requireAdmin(user) {
  if (!user || user.role !== "admin") {
    throw new Error("Forbidden");
  }
}

// =========================
// /ME ENDPOINT
// =========================
export async function getMe(request, env) {

  try {
    const user = await requireAuth(request, env);

    return new Response(JSON.stringify({ user }), { headers });

  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
}