// =========================
// SIMPLE TOKEN (TEMPORAIRE)
// =========================
export function generateToken(user) {
  return btoa(JSON.stringify(user));
}

export function getUserFromToken(request) {
  const auth = request.headers.get("Authorization");

  if (!auth) return null;

  const token = auth.split(" ")[1];

  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}
