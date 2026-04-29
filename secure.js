import { requireAuth, safeHandler, rateLimit, validateFields } from "./security.js";

// =========================
// CONFIG SÉCURITÉ FICHIERS
// =========================
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4"
];

// =========================
// VALIDATION FICHIER
// =========================
function validateFileMeta({ filename, type, size }) {

  if (!filename || !type || !size) {
    throw new Error("Missing file metadata");
  }

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error("File type not allowed");
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error("File too large");
  }

  // sécurité nom fichier (évite injections)
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new Error("Invalid filename");
  }
}

// =========================
// MOCK DB GALLERY (à remplacer)
// =========================
const galleryDB = [];

// =========================
// SAVE GALLERY
// =========================
export const saveGalleryHandler = safeHandler(async (request) => {

  const ip = request.headers.get("CF-Connecting-IP");

  // 🔒 rate limit
  if (!rateLimit("gallery:" + ip, 20, 60000)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
  }

  // 🔑 auth
  const user = requireAuth(request);

  const body = await request.json();

  validateFields(body, ["url", "description"]);

  const { url, description } = body;

  // validation URL minimale
  if (!url.startsWith("http")) {
    throw new Error("Invalid file URL");
  }

  const item = {
    id: "g_" + Date.now(),
    userId: user.id,
    url,
    description,
    createdAt: new Date().toISOString()
  };

  // 👉 remplacer par vraie DB (D1 / KV / etc)
  galleryDB.push(item);

  return new Response(JSON.stringify({
    success: true,
    item
  }), {
    headers: { "Content-Type": "application/json" }
  });

});

// =========================
// VALIDATION UPLOAD (OPTIONNEL AVANT SIGNATURE)
// =========================
export const validateUploadHandler = safeHandler(async (request) => {

  const ip = request.headers.get("CF-Connecting-IP");

  if (!rateLimit("upload-validate:" + ip, 15, 60000)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
  }

  requireAuth(request);

  const body = await request.json();

  validateFileMeta(body);

  return new Response(JSON.stringify({
    valid: true
  }), {
    headers: { "Content-Type": "application/json" }
  });

});