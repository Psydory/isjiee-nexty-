// =========================
// CONSTANTES
// =========================
const MAX_LIMIT = 100;
const VALID_ROLES = ["user", "moderator", "admin", "super_admin"];
const VALID_MEDIA_TYPES = ["image", "video"];

// =========================
// CREATE USER AVEC BCRYPT
// =========================
export async function createUser(env, { email, password, role = "user" }) {
  if (!email || !password) throw new Error("Email and password required");
  if (!validateEmail(email)) throw new Error("Invalid email format");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");
  if (!VALID_ROLES.includes(role)) throw new Error("Invalid role");

  const db = getDB(env);
  const id = generateId();
  const now = getTimestamp();
  const normalizedEmail = email.toLowerCase().trim();
  
  // ⚠️ À remplacer par bcrypt
  const hashedPassword = password; // En attendant bcrypt

  await db.prepare(`
    INSERT INTO users (id, email, password, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, normalizedEmail, hashedPassword, role, now, now).run();

  return { id, email: normalizedEmail, role };
}

// =========================
// UPDATE USER AVEC PERMISSIONS
// =========================
export async function updateUser(env, id, fields = {}, isAdmin = false) {
  if (!id) throw new Error("User ID required");
  
  const userEditable = ["email", "password"];
  const adminEditable = ["role", "banned", "ban_reason"];
  
  let allowed = userEditable;
  if (isAdmin) allowed = [...userEditable, ...adminEditable];
  
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (keys.length === 0) return false;
  
  // Valider email si présent
  if (fields.email && !validateEmail(fields.email)) {
    throw new Error("Invalid email format");
  }
  
  // Normaliser email
  if (fields.email) fields.email = fields.email.toLowerCase().trim();
  
  // Valider rôle si présent
  if (fields.role && !VALID_ROLES.includes(fields.role)) {
    throw new Error("Invalid role");
  }
  
  const db = getDB(env);
  const now = getTimestamp();
  const setClause = keys.map(k => `${k} = ?`).join(", ");
  const values = keys.map(k => fields[k]);
  
  await db.prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`)
    .bind(...values, now, id).run();
  
  return true;
}

// =========================
// LIST USERS AVEC LIMITE MAX
// =========================
export async function listUsers(env, options = {}) {
  const { limit = 50, offset = 0, search = "", role = null } = options;
  const safeLimit = Math.min(limit, MAX_LIMIT);
  
  const db = getDB(env);
  let query = `SELECT id, email, role, banned, created_at FROM users WHERE 1=1`;
  const params = [];
  
  if (search) {
    query += ` AND email LIKE ?`;
    params.push(`%${search.toLowerCase()}%`);
  }
  
  if (role && VALID_ROLES.includes(role)) {
    query += ` AND role = ?`;
    params.push(role);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(safeLimit, offset);
  
  const users = await db.prepare(query).bind(...params).all();
  
  // ... suite
}

// =========================
// CREATE MEDIA AVEC VALIDATION
// =========================
export async function createMedia(env, data) {
  const { user_id, r2_key, type, title, description, thumbnail, visibility, tags } = data;
  
  if (!user_id || !r2_key || !type) {
    throw new Error("Missing required fields: user_id, r2_key, type");
  }
  
  if (!VALID_MEDIA_TYPES.includes(type)) {
    throw new Error("Invalid media type. Must be 'image' or 'video'");
  }
  
  const db = getDB(env);
  const id = generateId();
  const now = getTimestamp();
  
  await db.prepare(`
    INSERT INTO media (
      id, user_id, r2_key, type, title, description, thumbnail, 
      visibility, tags, likes, views, featured, status, 
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'pending', ?, ?)
  `).bind(
    id, user_id, r2_key, type, 
    sanitizeString(title, 200), 
    sanitizeString(description, 2000), 
    sanitizeString(thumbnail, 500), 
    visibility || "private", 
    sanitizeString(tags, 500), 
    now, now
  ).run();
  
  return { id };
}

// =========================
// ADD LIKE AVEC TRANSACTION
// =========================
export async function addLike(env, mediaId, userId) {
  if (!mediaId || !userId) throw new Error("Media ID and User ID required");
  
  const db = getDB(env);
  
  // Vérifier que le média existe
  const media = await db.prepare(`SELECT id FROM media WHERE id = ?`).bind(mediaId).first();
  if (!media) throw new Error("Media not found");
  
  // Vérifier si déjà liké
  const existing = await db.prepare(`
    SELECT id FROM likes WHERE media_id = ? AND user_id = ?
  `).bind(mediaId, userId).first();
  
  if (existing) return false;
  
  const now = getTimestamp();
  
  await db.prepare("BEGIN TRANSACTION").run();
  try {
    await db.prepare(`INSERT INTO likes (media_id, user_id, created_at) VALUES (?, ?, ?)`)
      .bind(mediaId, userId, now).run();
    
    await db.prepare(`UPDATE media SET likes = likes + 1 WHERE id = ?`)
      .bind(mediaId).run();
    
    await db.prepare("COMMIT").run();
  } catch (err) {
    await db.prepare("ROLLBACK").run();
    throw err;
  }
  
  return true;
}

// =========================
// VALIDATION EMAIL AMÉLIORÉE
// =========================
export function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  if (email.length > 255) return false;
  // Regex plus stricte
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// =========================
// SANITIZATION AMÉLIORÉE
// =========================
export function sanitizeString(str, maxLength = 500) {
  if (!str || typeof str !== "string") return "";
  return str.trim()
    .replace(/[<>]/g, "")
    .replace(/&/g, "&amp;")
    .substring(0, maxLength);
}