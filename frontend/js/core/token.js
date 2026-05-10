// =========================
// TOKEN STORAGE KEY
// =========================
const TOKEN_KEY = "magazstars_token";

// =========================
// SAVE TOKEN
// =========================
export function setToken(token) {

  if (!token) return;

  localStorage.setItem(TOKEN_KEY, token);
}

// =========================
// GET TOKEN
// =========================
export function getToken() {

  return localStorage.getItem(TOKEN_KEY);
}

// =========================
// REMOVE TOKEN
// =========================
export function removeToken() {

  localStorage.removeItem(TOKEN_KEY);
}

// =========================
// CHECK AUTH
// =========================
export function isAuthenticated() {

  return !!getToken();
}

// =========================
// CREATE AUTH HEADERS
// =========================
export function authHeaders(headers = {}) {

  const token = getToken();

  return {
    ...headers,

    ...(token
      ? {
          Authorization: `Bearer ${token}`
        }
      : {})
  };
}

// =========================
// AUTO FETCH WRAPPER
// =========================
export async function authFetch(url, options = {}) {

  const config = {
    ...options,

    headers: authHeaders(
      options.headers || {}
    )
  };

  return fetch(url, config);
}

// =========================
// AUTO LOGOUT ON 401
// =========================
export async function secureFetch(url, options = {}) {

  const response = await authFetch(url, options);

  if (response.status === 401) {

    removeToken();

    console.warn("Session expired");

    // OPTIONAL REDIRECT
    // window.location.href = "/login.html";
  }

  return response;
}
