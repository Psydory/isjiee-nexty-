// =========================
// IMPORTS
// =========================
import { SignJWT, jwtVerify } from "jose";

// =========================
// CONFIG
// =========================
const SECRET = new TextEncoder().encode("SUPER_SECRET_KEY_CHANGE_ME");

// durée
const ACCESS_EXPIRE = "15m";
const REFRESH_EXPIRE = "7d";

// =========================
// TOKEN GENERATION
// =========================
async function generateAccessToken(user) {
  return await new SignJWT({
    id: user.id,
    role: user.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(ACCESS_EXPIRE)
    .sign(SECRET);
}

async function generateRefreshToken(user) {
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
async function verifyToken(token) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload;
}

// =========================
// LOGIN
// =========================
export async function login(request, env) {

  const { email, password } = await request.json();

  // 🔒 vérifier utilisateur DB
  const user = await env.DB.prepare(`
    SELECT * FROM users WHERE email = ?
  `).bind(email).first();

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 401 });
  }

  // ⚠️ remplacer par hash (bcrypt plus tard)
  if (user.password !== password) {
    return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401 });
  }

  if (user.banned) {
    return new Response(JSON.stringify({ error: "User banned" }), { status: 403 });
  }

  const token = await generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  return new Response(JSON.stringify({
    token,
    refreshToken,
    user: {
      id: user.id,
      role: user.role
    }
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

// =========================
// REFRESH TOKEN
// =========================
export async function refresh(request) {

  const { refreshToken } = await request.json();

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: "Missing refresh token" }), { status: 400 });
  }

  try {

    const payload = await verifyToken(refreshToken);

    const newToken = await generateAccessToken(payload);
    const newRefresh = await generateRefreshToken(payload);

    return new Response(JSON.stringify({
      token: newToken,
      refreshToken: newRefresh
    }));

  } catch {
    return new Response(JSON.stringify({ error: "Invalid refresh token" }), { status: 401 });
  }
}

// =========================
// AUTH MIDDLEWARE
// =========================
export async function requireAuth(request) {

  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");

  try {

    const payload = await verifyToken(token);

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
export async function getMe(request) {

  try {
    const user = await requireAuth(request);

    return new Response(JSON.stringify({
      user
    }));

  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
}