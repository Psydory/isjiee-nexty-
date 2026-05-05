// =========================
// CONFIG
// =========================
const API_BASE = "https://spadha30worker.dev"; // ⚠️ remplace si besoin

// =========================
// STORAGE KEYS
// =========================
const TOKEN_KEY = "token";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "user";

// =========================
// LOGIN
// =========================
async function login(email, password) {

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  // 🔐 STORE
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));

  return data.user;
}

// =========================
// LOGOUT
// =========================
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);

  window.location.href = "/login.html";
}

// =========================
// AUTH CHECK
// =========================
function isAuthenticated() {
  return !!localStorage.getItem(TOKEN_KEY);
}

// =========================
// GET USER
// =========================
function getUser() {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

// =========================
// ROLE REDIRECT
// =========================
function redirectByRole(user) {

  if (!user) return;

  if (user.role === "admin") {
    window.location.href = "/admin.html";
  } else {
    window.location.href = "/dashboard.html";
  }
}

// =========================
// REFRESH TOKEN
// =========================
async function refreshToken() {

  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return;

  try {

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken: refresh })
    });

    const data = await res.json();

    if (!res.ok) {
      logout();
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);

  } catch (err) {
    console.error("Refresh error:", err);
    logout();
  }
}

// =========================
// AUTO REFRESH (SILENT)
// =========================
function initAutoRefresh() {

  // refresh toutes les 10 minutes
  setInterval(() => {
    refreshToken();
  }, 10 * 60 * 1000);
}

// =========================
// AUTH HEADER
// =========================
function getAuthHeader() {

  const token = localStorage.getItem(TOKEN_KEY);

  return token
    ? { Authorization: "Bearer " + token }
    : {};
}

// =========================
// PROTECT PAGE (OPTIONNEL)
// =========================
function protectPage() {

  if (!isAuthenticated()) {
    window.location.href = "/login.html";
  }
}

// =========================
// EXPORT
// =========================
export default {
  login,
  logout,
  isAuthenticated,
  getUser,
  redirectByRole,
  refreshToken,
  initAutoRefresh,
  getAuthHeader,
  protectPage
};