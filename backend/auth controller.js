// =========================
// IMPORTS
// =========================
import { hashPassword, verifyPassword } from "../security/password.js";
import { signJWT } from "../utils/jwt.js";
import { createUser, getUserByEmail } from "../db.js";

// =========================
// REGISTER
// =========================
export async function register(request, env) {

  try {

    const body = await request.json();
    const { email, password, role = "student" } = body;

    // =========================
    // VALIDATION
    // =========================
    if (!email || !password) {
      return json({ error: "Email et mot de passe requis" }, 400);
    }

    // =========================
    // CHECK EXISTING USER
    // =========================
    const existingUser = await getUserByEmail(env, email);

    if (existingUser) {
      return json({ error: "Utilisateur déjà existant" }, 409);
    }

    // =========================
    // HASH PASSWORD
    // =========================
    const hashedPassword = await hashPassword(password);

    // =========================
    // CREATE USER
    // =========================
    const user = await createUser(env, {
      email,
      password: hashedPassword,
      role
    });

    // =========================
    // GENERATE TOKEN
    // =========================
    const token = signJWT({
      id: user.id,
      email: user.email,
      role: user.role
    }, env.JWT_SECRET);

    return json({
      success: true,
      message: "Inscription réussie",
      user,
      token
    });

  } catch (err) {

    console.error("Register Error:", err);

    return json({ error: "Erreur inscription" }, 500);
  }
}

// =========================
// LOGIN
// =========================
export async function login(request, env) {

  try {

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return json({ error: "Champs requis" }, 400);
    }

    // =========================
    // FIND USER
    // =========================
    const user = await getUserByEmail(env, email);

    if (!user) {
      return json({ error: "Utilisateur introuvable" }, 404);
    }

    // =========================
    // VERIFY PASSWORD
    // =========================
    const valid = await verifyPassword(password, user.password);

    if (!valid) {
      return json({ error: "Mot de passe incorrect" }, 401);
    }

    // =========================
    // TOKEN
    // =========================
    const token = signJWT({
      id: user.id,
      email: user.email,
      role: user.role
    }, env.JWT_SECRET);

    return json({
      success: true,
      message: "Connexion réussie",
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (err) {

    console.error("Login Error:", err);

    return json({ error: "Erreur connexion" }, 500);
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
