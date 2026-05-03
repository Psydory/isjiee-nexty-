// =========================
// API CLIENT CENTRAL
// =========================

const API_BASE = "https://votre-worker.workers.dev"; // ⚠️ à remplacer

// =========================
// TOKEN MANAGEMENT
// =========================
function getToken() {
  return localStorage.getItem("token");
}

// =========================
// CORE FETCH
// =========================
async function request(endpoint, options = {}) {

  const token = getToken();

  const config = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` })
    }
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(API_BASE + endpoint, config);

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Erreur API");
    }

    return data;

  } catch (err) {
    console.error("API ERROR:", err.message);
    throw err;
  }
}

// =========================
// METHODS SIMPLIFIÉS
// =========================
export const api = {

  get: (url) => request(url),

  post: (url, body) => request(url, {
    method: "POST",
    body
  }),

  put: (url, body) => request(url, {
    method: "PUT",
    body
  }),

  delete: (url) => request(url, {
    method: "DELETE"
  })

};
