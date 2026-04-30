// =========================
// STANDARD RESPONSE
// =========================
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

// =========================
// SUCCESS
// =========================
export function ok(data = {}) {
  return jsonResponse({
    success: true,
    ...data
  }, 200);
}

// =========================
// FAIL (CLIENT ERROR)
// =========================
export function fail(message = "Erreur", status = 400) {
  return jsonResponse({
    success: false,
    error: message
  }, status);
}

// =========================
// SERVER ERROR
// =========================
export function serverError(message = "Erreur serveur") {
  return jsonResponse({
    success: false,
    error: message
  }, 500);
}

// =========================
// GLOBAL TRY/CATCH WRAPPER
// =========================
export function withErrorHandler(handler) {

  return async (request, env) => {

    try {
      return await handler(request, env);
    } catch (err) {

      console.error("🔥 ERROR:", err);

      return serverError();
    }
  };
}
