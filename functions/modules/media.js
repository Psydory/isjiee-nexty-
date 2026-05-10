// =========================
// HELPERS
// =========================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function uid() {
  return crypto.randomUUID();
}

// =========================
// CREATE UPLOAD URL (R2)
// =========================
export async function createUploadUrl(request, env) {
  const body = await request.json();

  const { type } = body;

  if (!type || !["image", "video"].includes(type)) {
    return json({ error: "Invalid type" }, 400);
  }

  const id = uid();
  const key = `media/${id}`;

  // URL signée R2
  const uploadUrl = await env.MEDIA_BUCKET.createMultipartUpload(key);

  return json({
    id,
    key,
    uploadUrl
  });
}

// =========================
// VALIDATE + SAVE MEDIA
// =========================
export async function validateAndSaveMedia(request, env) {
  const body = await request.json();

  const {
    id,
    url,
    type,
    title,
    description,
    visibility,
    thumbnail,
    tags
  } = body;

  if (!id || !url || !type) {
    return json({ error: "Missing fields" }, 400);
  }

  const user = request.user; // injecté par router

  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO media (
      id, user_id, url, type, title, description,
      thumbnail, visibility, likes, views, tags,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
  `).bind(
    id,
    user.id,
    url,
    type,
    title || "",
    description || "",
    thumbnail || "",
    visibility || "private",
    tags || "",
    now,
    now
  ).run();

  return json({ success: true });
}

// =========================
// GET MEDIA (USER + PUBLIC)
// =========================
export async function getMediaGallery(request, env) {

  const user = request.user;

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode"); // public / user

  let result;

  if (mode === "public") {
    result = await env.DB.prepare(`
      SELECT * FROM media
      WHERE visibility = 'public'
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
  } else {
    result = await env.DB.prepare(`
      SELECT * FROM media
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all();
  }

  return json({ media: result.results });
}

// =========================
// DELETE MEDIA
// =========================
export async function deleteMedia(request, env) {

  const body = await request.json();
  const { id } = body;

  const user = request.user;

  if (!id) {
    return json({ error: "Missing id" }, 400);
  }

  // vérifier ownership
  const existing = await env.DB.prepare(`
    SELECT * FROM media WHERE id = ?
  `).bind(id).first();

  if (!existing) {
    return json({ error: "Not found" }, 404);
  }

  if (existing.user_id !== user.id) {
    return json({ error: "Forbidden" }, 403);
  }

  // supprimer DB
  await env.DB.prepare(`
    DELETE FROM media WHERE id = ?
  `).bind(id).run();

  // supprimer R2 (optionnel mais recommandé)
  try {
    await env.MEDIA_BUCKET.delete(`media/${id}`);
  } catch (err) {
    console.error("R2 delete error", err);
  }

  return json({ success: true });
}

// =========================
// ADD VIEW
// =========================
export async function addView(request, env) {

  const body = await request.json();
  const { id } = body;

  if (!id) return json({ error: "Missing id" }, 400);

  await env.DB.prepare(`
    UPDATE media
    SET views = views + 1
    WHERE id = ?
  `).bind(id).run();

  return json({ success: true });
}

// =========================
// ADD LIKE
// =========================
export async function addLike(request, env) {

  const body = await request.json();
  const { id } = body;

  if (!id) return json({ error: "Missing id" }, 400);

  await env.DB.prepare(`
    UPDATE media
    SET likes = likes + 1
    WHERE id = ?
  `).bind(id).run();

  return json({ success: true });
}