// =========================
// functions/api/core/errorHandler.js
// VERSION FINALE COMPLÈTE
// =========================

// =========================
// HEADERS CORS
// =========================
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// =========================
// RÉPONSE DE BASE
// =========================
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

// =========================
// SUCCÈS (2xx)
// =========================
export function ok(data = {}) {
  return jsonResponse({ success: true, ...data }, 200);
}

export function created(data = {}) {
  return jsonResponse({ success: true, ...data }, 201);
}

export function noContent() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// =========================
// PAGINATION
// =========================
export function paginated(data, page, limit, total) {
  return ok({
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
}

// =========================
// ERREURS CLIENT (4xx)
// =========================
export function badRequest(message = "Bad request") {
  return jsonResponse({ success: false, error: message }, 400);
}

export function unauthorized(message = "Unauthorized") {
  return jsonResponse({ success: false, error: message }, 401);
}

export function forbidden(message = "Forbidden") {
  return jsonResponse({ success: false, error: message }, 403);
}

export function notFound(message = "Not found") {
  return jsonResponse({ success: false, error: message }, 404);
}

export function conflict(message = "Conflict") {
  return jsonResponse({ success: false, error: message }, 409);
}

export function validationError(fields = []) {
  return jsonResponse({
    success: false,
    error: "Validation failed",
    fields
  }, 422);
}

export function tooManyRequests(message = "Too many requests") {
  return jsonResponse({ success: false, error: message }, 429);
}

// =========================
// ERREUR SERVEUR (5xx)
// =========================
export function serverError(message = "Internal server error") {
  return jsonResponse({ success: false, error: message }, 500);
}

// =========================
// OPTIONS CORS
// =========================
export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

// =========================
// WRAPPER AVEC GESTION D'ERREUR
// =========================
export function withErrorHandler(handler) {
  return async (request, env, user) => {
    try {
      const result = await handler(request, env, user);
      
      // Si le handler a retourné une Response, la retourner
      if (result instanceof Response) {
        return result;
      }
      
      // Sinon, convertir en succès
      return ok(result);
      
    } catch (err) {
      console.error("Handler error:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
      // Mapping intelligent des erreurs
      const message = err.message || "Internal server error";
      
      if (message === "Unauthorized" || message === "Missing authorization header") {
        return unauthorized(message);
      }
      
      if (message === "Forbidden") {
        return forbidden(message);
      }
      
      if (message.includes("not found")) {
        return notFound(message);
      }
      
      if (message.includes("Missing field") || message.includes("validation")) {
        return validationError([message]);
      }
      
      if (message === "Too many requests") {
        return tooManyRequests(message);
      }
      
      return serverError(message);
    }
  };
}

// =========================
// WRAPPER POUR ROUTES PUBLIQUES
// =========================
export function publicHandler(handler) {
  return withErrorHandler(handler);
}

// =========================
// WRAPPER POUR ROUTES PROTÉGÉES
// =========================
export function authHandler(handler) {
  return withErrorHandler(async (request, env, user) => {
    if (!user) {
      return unauthorized();
    }
    return handler(request, env, user);
  });
}
