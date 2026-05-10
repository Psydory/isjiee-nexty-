// =========================
// SUCCESS RESPONSE
// =========================
export function success(data = {}, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    data
  }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

// =========================
// ERROR RESPONSE
// =========================
export function error(message = "Erreur", status = 400) {
  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
