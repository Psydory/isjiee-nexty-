// =========================
// IMPORTS
// =========================
import { sign } from "../core/jwt.js";

// =========================
// HELPERS
// =========================
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
};

function json(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers
    }
  );
}

// =========================
// LOGIN
// =========================
export async function login(req, env) {

  try {

    const body = await req.json();

    const email =
      body.email?.trim()?.toLowerCase();

    const password =
      body.password?.trim();

    // =========================
    // VALIDATION
    // =========================
    if (!email || !password) {

      return json(
        {
          success: false,
          error: "Missing credentials"
        },
        400
      );
    }

    // =========================
    // DEMO USER
    // =========================
    // Remplace plus tard avec D1
    if (
      email !== "admin@isjiee.com" ||
      password !== "123456"
    ) {

      return json(
        {
          success: false,
          error: "Invalid credentials"
        },
        401
      );
    }

    // =========================
    // USER
    // =========================
    const user = {
      id: 1,
      role: "admin",
      email
    };

    // =========================
    // TOKEN
    // =========================
    let token = "demo-token";

    try {

      if (sign) {

        token = await sign(
          user,
          env.JWT_SECRET || "isjiee-secret"
        );
      }

    } catch {}

    // =========================
    // SUCCESS
    // =========================
    return json({
      success: true,
      token,
      user
    });

  } catch (err) {

    return json(
      {
        success: false,
        error: "Login failed"
      },
      500
    );
  }
}

// =========================
// REFRESH TOKEN
// =========================
export async function refresh(req, env) {

  return json({
    success: true,
    message: "Refresh OK"
  });
}

// =========================
// CURRENT USER
// =========================
export async function getMe(req, env) {

  try {

    const auth =
      req.headers.get("Authorization");

    if (!auth) {

      return json(
        {
          success: false,
          error: "Unauthorized"
        },
        401
      );
    }

    return json({
      success: true,
      user: {
        role: "admin"
      }
    });

  } catch {

    return json(
      {
        success: false,
        error: "Failed"
      },
      500
    );
  }
}