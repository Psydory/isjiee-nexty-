// =========================
// PARSE JSON BODY
// =========================
export async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}