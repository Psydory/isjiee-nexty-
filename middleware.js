// =========================
// CONFIG
// =========================
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  max: 60 // requêtes max / fenêtre
};

// stockage mémoire (simple)
const rateStore = new Map();

// =========================
// UTILS
// =========================
function getClientKey(request, user) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "anon";

  return user ? `user:${user.id}` : `ip:${ip}`;
}

// =========================
// RATE LIMIT
// =========================
function applyRateLimit(request, user) {

  const key = getClientKey(request, user);
  const now = Date.now();

  if (!rateStore.has(key)) {
    rateStore.set(key, []);
  }

  const timestamps = rateStore
    .get(key)
    .filter(t => now - t < RATE_LIMIT.windowMs);

  if (timestamps.length >= RATE_LIMIT.max) {
    throw new Error("Too many requests");
  }

  timestamps.push(now);
  rateStore.set(key, timestamps);
}

// =========================
// JSON RESPONSE
// =========================
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

// =========================
// VALIDATION
// =========================
function validate(body, schema) {

  for (const field in schema) {

    const rule = schema[field];
    const value = body[field];

    if (rule.required && !value) {
      throw new Error(`Missing field: ${field}`);
    }

    if (value && rule.type && typeof value !== rule.type) {
      throw new Error(`Invalid type: ${field}`);
    }

    // basic sanitize (string)
    if (typeof value === "string") {
      body[field] = value.trim();
    }
  }

  return body;
}

// =========================
// GLOBAL HANDLER WRAPPER
// =========================
export function withMiddleware(handler, options = {}) {

  return async (request, env) => {

    try {

      let user = null;

      // =========================
      // AUTH (OPTIONAL)
      // =========================
      if (options.auth) {
        const { requireAuth } = await import("./auth-system.js");
        user = await requireAuth(request);
        request.user = user;
      }

      // =========================
      // ADMIN CHECK
      // =========================
      if (options.admin) {
        const { requireAdmin } = await import("./auth-system.js");
        requireAdmin(user);
      }

      // =========================
      // RATE LIMIT
      // =========================
      if (options.rateLimit !== false) {
        applyRateLimit(request, user);
      }

      // =========================
      // BODY PARSE
      // =========================
      let body = {};
      if (request.method !== "GET") {
        body = await request.json().catch(() => ({}));
      }

      // =========================
      // VALIDATION
      // =========================
      if (options.validate) {
        body = validate(body, options.validate);
      }

      request.body = body;

      // =========================
      // EXECUTE HANDLER
      // =========================
      return await handler(request, env);

    } catch (err) {

      console.error("Middleware Error:", err.message);

      // =========================
      // ERROR NORMALIZATION
      // =========================
      if (err.message === "Unauthorized") {
        return json({ error: err.message }, 401);
      }

      if (err.message === "Forbidden") {
        return json({ error: err.message }, 403);
      }

      if (err.message === "Too many requests") {
        return json({ error: err.message }, 429);
      }

      return json({ error: err.message || "Server error" }, 400);
    }
  };
}