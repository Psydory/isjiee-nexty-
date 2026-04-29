// =========================
// CONFIG
// =========================
const API_URL = "https://your-worker.workers.dev"; // ⚠️ à remplacer

// =========================
// FETCH WRAPPER
// =========================
export async function apiFetch(endpoint, options = {}) {

  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  const res = await fetch(API_URL + endpoint, {
    ...options,
    headers
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}