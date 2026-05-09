// =========================
// IMPORTS
// =========================
import { getUserById, updateUser } from "../db.js";

// =========================
// GET PROFILE
// =========================
export async function getProfile(request, env) {

  try {

    const user = request.user;

    if (!user) {
      return json({ error: "Non autorisé" }, 401);
    }

    const dbUser = await getUserById(env, user.id);

    if (!dbUser) {
      return json({ error: "Utilisateur introuvable" }, 404);
    }

    return json({
      success: true,
      user: dbUser
    });

  } catch (err) {

    console.error("Profile Error:", err);

    return json({ error: "Erreur serveur" }, 500);
  }
}

// =========================
// UPDATE PROFILE
// =========================
export async function updateProfile(request, env) {

  try {

    const user = request.user;

    if (!user) {
      return json({ error: "Non autorisé" }, 401);
    }

    const body = await request.json();

    // Champs autorisés uniquement
    const allowedFields = ["email"];
    const updates = {};

    for (let key of allowedFields) {
      if (body[key]) {
        updates[key] = body[key];
      }
    }

    if (!Object.keys(updates).length) {
      return json({ error: "Aucune donnée valide" }, 400);
    }

    await updateUser(env, user.id, updates);

    return json({
      success: true,
      message: "Profil mis à jour"
    });

  } catch (err) {

    console.error("Update Profile Error:", err);

    return json({ error: "Erreur mise à jour" }, 500);
  }
}

// =========================
// JSON HELPER
// =========================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
