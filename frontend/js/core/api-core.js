// =========================
// IMPORTS
// =========================
import URLS from "./url.js";
import UI from "./uisystem.js";

// =========================
// CONFIG
// =========================
const API = {};

API.base = URLS.base || "";

// retry config
API.retryCount = 2;

// timeout (ms)
API.timeout = 8000;

// cache (GET uniquement)
API.cache = new Map();

// =========================
// TOKEN MANAGEMENT
// =========================
API.getToken = () => localStorage.getItem("token");
API.getRefreshToken = () => localStorage.getItem("refreshToken");

API.setTokens = ({ token, refreshToken }) => {
  if (token) localStorage.setItem("token", token);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
};

API.clearTokens = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
};

// =========================
// OFFLINE CHECK
// =========================
API.isOnline = () => navigator.onLine;

// =========================
// TIMEOUT HANDLER
// =========================
API.fetchWithTimeout = (url, options) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API.timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(id));
};

// =========================
// REFRESH TOKEN
// =========================
API.refreshToken = async () => {

  const refreshToken = API.getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(URLS.build("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!res.ok) {
    API.clearTokens();
    window.location.href = URLS.pages.login;
    throw new Error("Session expirée");
  }

  const data = await res.json();
  API.setTokens(data);

  return data.token;
};

// =========================
// CORE REQUEST
// =========================
API.request = async (endpoint, options = {}, retry = 0) => {

  if (!API.isOnline()) {
    UI.toast("Hors ligne", "error");
    throw new Error("Offline");
  }

  const url = URLS.build(endpoint);
  const token = API.getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  const config = {
    ...options,
    headers
  };

  const cacheKey = url;

  // =========================
  // CACHE (GET)
  // =========================
  if (config.method === "GET" || !config.method) {
    if (API.cache.has(cacheKey)) {
      return API.cache.get(cacheKey);
    }
  }

  try {

    const res = await API.fetchWithTimeout(url, config);

    const data = await res.json().catch(() => ({}));

    // =========================
    // 401 → REFRESH TOKEN
    // =========================
    if (res.status === 401 && retry === 0) {
      try {
        const newToken = await API.refreshToken();

        return API.request(endpoint, {
          ...options,
          headers: {
            ...headers,
            Authorization: "Bearer " + newToken
          }
        }, 1);

      } catch {
        throw new Error("Session expirée");
      }
    }

    if (!res.ok) {
      throw new Error(data.error || "Erreur API");
    }

    // =========================
    // CACHE STORE
    // =========================
    if (config.method === "GET" || !config.method) {
      API.cache.set(cacheKey, data);
    }

    return data;

  } catch (err) {

    if (retry < API.retryCount) {
      return API.request(endpoint, options, retry + 1);
    }

    console.error("API ERROR:", err.message);
    UI.toast(err.message || "Erreur réseau", "error");

    throw err;
  }
};

// =========================
// METHODS
// =========================
API.get = (url) => API.request(url, { method: "GET" });

API.post = (url, body) =>
  API.request(url, {
    method: "POST",
    body: JSON.stringify(body)
  });

API.put = (url, body) =>
  API.request(url, {
    method: "PUT",
    body: JSON.stringify(body)
  });

API.delete = (url, body) =>
  API.request(url, {
    method: "DELETE",
    body: JSON.stringify(body)
  });

// =========================
// MEDIA API
// =========================
API.media = {

  // pagination (FIX IMPORTANT)
  getPage: (page = 1, limit = 10) =>
    API.get(`/media?page=${page}&limit=${limit}`),

  getAll: () => API.get(URLS.api.media.base),

  getPublic: () => API.get(URLS.api.media.public),

  getTrending: () => API.get("/media/trending"),

  getPersonalized: () => API.get("/media/personalized"),

  uploadUrl: (type) =>
    API.post(URLS.api.media.uploadUrl, { type }),

  save: (data) =>
    API.post(URLS.api.media.validate, data),

  delete: (id) =>
    API.post(URLS.api.media.delete, { id }),

  like: (id) =>
    API.post(URLS.api.media.like, { id }),

  view: (id) =>
    API.post(URLS.api.media.view, { id })
};

// =========================
// EXPORT
// =========================
export default API;
