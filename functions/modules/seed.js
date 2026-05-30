// =========================
// functions/api/seed.js
// VERSION FINALE COMPLÈTE
// =========================

import { ok, unauthorized, badRequest, serverError, withErrorHandler } from "./core/errorHandler.js";

// =========================
// CONSTANTES
// =========================
const MAX_URL_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;

// =========================
// GÉNÉRER ID (sécurisé)
// =========================
function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback robuste
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${performance.now()}`;
  }
}

// =========================
// TIMING SAFE COMPARE
// =========================
function timingSafeEqual(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// =========================
// VALIDATION URL
// =========================
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.length > MAX_URL_LENGTH) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// =========================
// CRÉER TABLE SETTINGS
// =========================
async function ensureSettingsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at INTEGER
    )
  `).run();
}

// =========================
// CRÉER ADMIN SI NÉCESSAIRE
// =========================
async function ensureAdminUser(env) {
  // Vérifier si admin existe
  let adminUser = await env.DB.prepare(`
    SELECT id FROM users WHERE role = 'admin' LIMIT 1
  `).first();
  
  if (!adminUser) {
    const adminId = generateId();
    const now = Date.now();
    
    // ⚠️ Mot de passe temporaire - À changer après déploiement
    // En production, utilise bcrypt et change ce mot de passe immédiatement
    const tempPassword = "changeMe123!";
    
    await env.DB.prepare(`
      INSERT INTO users (id, email, password, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(adminId, "admin@isjiee.com", tempPassword, "admin", now, now).run();
    
    adminUser = { id: adminId };
    console.warn("⚠️ Admin created with temporary password: changeMe123! - CHANGE IT IMMEDIATELY");
  }
  
  return adminUser;
}

// =========================
// VÉRIFIER SI SEED DÉJÀ EXÉCUTÉ
// =========================
async function isSeedDone(env) {
  const check = await env.DB.prepare(`
    SELECT value FROM settings WHERE key = 'seed_done'
  `).first();
  return check && check.value === 'true';
}

// =========================
// INSÉRER MÉDIA AVEC VÉRIFICATION
// =========================
async function insertMediaIfNotExists(env, media, adminId, now) {
  // Vérifier si média existe déjà (par URL)
  const existing = await env.DB.prepare(`
    SELECT id FROM media WHERE url = ? LIMIT 1
  `).bind(media.url).first();
  
  if (existing) {
    return false; // Déjà existant
  }
  
  // Valider URL
  if (!isValidUrl(media.url)) {
    console.warn(`Invalid URL skipped: ${media.url}`);
    return false;
  }
  
  // Nettoyer le titre
  const cleanTitle = media.title?.substring(0, MAX_TITLE_LENGTH) || "Untitled";
  
  await env.DB.prepare(`
    INSERT INTO media (
      id, user_id, url, type, title, description, thumbnail,
      visibility, tags, likes, views, featured, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
  `).bind(
    generateId(), adminId, media.url, media.type, cleanTitle,
    media.description || "", "", "public", media.tags || "",
    media.featured || 0, "approved", now, now
  ).run();
  
  return true;
}

// =========================
// DATA (complète et variée)
// =========================
const mediaItems = [
  {
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    type: "image",
    title: "Nature Glow — énergie naturelle",
    description: "Découvrez la beauté de la nature et laissez-vous inspirer",
    tags: "nature,énergie,inspiration",
    featured: 1
  },
  {
    url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
    type: "image",
    title: "Portrait — jeune femme ambitieuse",
    description: "La détermination et l'ambition au féminin",
    tags: "portrait,ambition,féminin",
    featured: 1
  },
  {
    url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564",
    type: "image",
    title: "L'univers — vision sans limite",
    description: "Explorez l'infini et repoussez vos limites",
    tags: "univers,vision,infini",
    featured: 0
  },
  {
    url: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa",
    type: "image",
    title: "Galaxie — expansion digitale",
    description: "L'expansion digitale n'a pas de limites",
    tags: "galaxie,digital,expansion",
    featured: 0
  },
  {
    url: "https://images.unsplash.com/photo-1556761175-b413da4baf72",
    type: "image",
    title: "Grand salon entrepreneur",
    description: "L'entrepreneuriat moderne en action",
    tags: "entrepreneur,leadership,action",
    featured: 1
  },
  {
    url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f",
    type: "image",
    title: "Academy — formation & leadership",
    description: "Formez-vous et devenez leader",
    tags: "formation,leadership,academy",
    featured: 0
  },
  {
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475",
    type: "image",
    title: "Innovation digitale",
    description: "L'innovation au cœur de la transformation digitale",
    tags: "innovation,digital,technologie",
    featured: 0
  },
  {
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    type: "image",
    title: "Focus & détermination",
    description: "Atteignez vos objectifs avec détermination",
    tags: "focus,détermination,objectif",
    featured: 0
  },
  {
    url: "https://images.unsplash.com/photo-1557804506-669a67965ba0",
    type: "image",
    title: "Teamwork — collaboration efficace",
    description: "Travail d'équipe et synergie",
    tags: "teamwork,collaboration,équipe",
    featured: 0
  },
  {
    url: "https://images.unsplash.com/photo-1531482615713-2afd69097998",
    type: "image",
    title: "Leadership — inspirer les autres",
    description: "Devenez un leader inspirant",
    tags: "leadership,inspiration,manager",
    featured: 1
  }
];

// =========================
// SEED MEDIA (EXPORT PRINCIPAL)
// =========================
export const seedMedia = withErrorHandler(async (request, env) => {
  // =========================
  // 1. SÉCURITÉ
  // =========================
  const seedKey = request.headers.get("x-seed-key");
  let isAuthorized = false;
  
  // Vérifier clé seed (timing safe)
  if (seedKey && timingSafeEqual(seedKey, env.SEED_KEY)) {
    isAuthorized = true;
  }
  
  // Vérifier admin via token
  const authHeader = request.headers.get("Authorization");
  if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
    try {
      const { requireAuthJWT } = await import("./core/jwt.js");
      const user = await requireAuthJWT(request, env.JWT_SECRET);
      if (user.role === "admin") isAuthorized = true;
    } catch {}
  }
  
  if (!isAuthorized) {
    return unauthorized("Invalid seed key or admin token");
  }
  
  // =========================
  // 2. PRÉPARATION
  // =========================
  await ensureSettingsTable(env);
  
  const alreadySeeded = await isSeedDone(env);
  if (alreadySeeded) {
    return badRequest("Seed already executed. Use POST /seed/reset to allow re-seeding.");
  }
  
  const adminUser = await ensureAdminUser(env);
  const now = Date.now();
  
  // =========================
  // 3. TRANSACTION
  // =========================
  await env.DB.prepare("BEGIN TRANSACTION").run();
  
  try {
    let inserted = 0;
    let skipped = 0;
    
    for (const item of mediaItems) {
      const success = await insertMediaIfNotExists(env, item, adminUser.id, now);
      if (success) inserted++;
      else skipped++;
    }
    
    // Marquer seed comme exécuté
    await env.DB.prepare(`
      INSERT OR REPLACE INTO settings (key, value, created_at)
      VALUES ('seed_done', 'true', ?)
    `).bind(now).run();
    
    await env.DB.prepare("COMMIT").run();
    
    return ok({
      message: "Seed executed successfully",
      inserted,
      skipped,
      total: mediaItems.length,
      admin_email: "admin@isjiee.com",
      admin_temp_password: "changeMe123!"
    });
    
  } catch (err) {
    await env.DB.prepare("ROLLBACK").run();
    console.error("Seed transaction error:", err);
    return serverError(`Seed failed: ${err.message}`);
  }
});

// =========================
// RESET SEED (admin only)
// =========================
export const resetSeed = withErrorHandler(async (request, env) => {
  // Double vérification: admin + seed key
  const seedKey = request.headers.get("x-seed-key");
  const authHeader = request.headers.get("Authorization");
  
  let isAdmin = false;
  let hasSeedKey = false;
  
  // Vérifier clé seed
  if (seedKey && timingSafeEqual(seedKey, env.SEED_KEY)) {
    hasSeedKey = true;
  }
  
  // Vérifier admin
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { requireAuthJWT } = await import("./core/jwt.js");
      const user = await requireAuthJWT(request, env.JWT_SECRET);
      if (user.role === "admin") isAdmin = true;
    } catch {}
  }
  
  if (!isAdmin && !hasSeedKey) {
    return unauthorized("Admin access or seed key required");
  }
  
  await ensureSettingsTable(env);
  
  // Supprimer le verrou
  await env.DB.prepare(`DELETE FROM settings WHERE key = 'seed_done'`).run();
  
  return ok({ 
    message: "Seed reset successfully. You can now run POST /seed/media again.",
    warning: "This will not delete existing media, only allow re-seeding new ones."
  });
});

// =========================
// SEED STATUS
// =========================
export const getSeedStatus = withErrorHandler(async (request, env) => {
  await ensureSettingsTable(env);
  const seeded = await isSeedDone(env);
  
  // Compter les médias existants
  const mediaCount = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM media
  `).first();
  
  return ok({
    seeded,
    media_count: mediaCount?.total || 0,
    can_seed: !seeded
  });
});
