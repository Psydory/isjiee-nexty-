import { safeHandler, rateLimit } from "./security.js";
import { requireAuthJWT } from "./auth-jwt.js";

// =========================
// MOCK DB (à remplacer)
// =========================
const usersDB = new Map();      // email → { role, createdAt }
const galleryDB = [];           // [{ id, userId, url, description }]
const transactionsDB = [];      // [{ userId, amount, source }]

// =========================
// VERIFY ADMIN
// =========================
async function requireAdmin(request, env) {
  const user = await requireAuthJWT(request, env.JWT_SECRET);

  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }

  return user;
}

// =========================
// GET USERS
// =========================
export const getUsersHandler = safeHandler(async (request, env) => {

  const ip = request.headers.get("CF-Connecting-IP");

  if (!rateLimit("admin-users:" + ip, 20, 60000)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
  }

  await requireAdmin(request, env);

  const users = Array.from(usersDB.entries()).map(([email, data]) => ({
    email,
    role: data.role,
    createdAt: data.createdAt
  }));

  return new Response(JSON.stringify({ users }), {
    headers: { "Content-Type": "application/json" }
  });

});

// =========================
// DELETE USER
// =========================
export const deleteUserHandler = safeHandler(async (request, env) => {

  await requireAdmin(request, env);

  const body = await request.json();
  const { email } = body;

  if (!email || !usersDB.has(email)) {
    throw new Error("User not found");
  }

  usersDB.delete(email);

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: { "Content-Type": "application/json" }
  });

});

// =========================
// GET GALLERY
// =========================
export const getGalleryHandler = safeHandler(async (request, env) => {

  await requireAdmin(request, env);

  return new Response(JSON.stringify({
    gallery: galleryDB
  }), {
    headers: { "Content-Type": "application/json" }
  });

});

// =========================
// DELETE GALLERY ITEM
// =========================
export const deleteGalleryHandler = safeHandler(async (request, env) => {

  await requireAdmin(request, env);

  const body = await request.json();
  const { id } = body;

  const index = galleryDB.findIndex(item => item.id === id);

  if (index === -1) {
    throw new Error("Item not found");
  }

  galleryDB.splice(index, 1);

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: { "Content-Type": "application/json" }
  });

});

// =========================
// GET TRANSACTIONS
// =========================
export const getTransactionsHandler = safeHandler(async (request, env) => {

  await requireAdmin(request, env);

  return new Response(JSON.stringify({
    transactions: transactionsDB
  }), {
    headers: { "Content-Type": "application/json" }
  });

});
