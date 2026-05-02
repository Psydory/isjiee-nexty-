// =========================
// CONFIG
// =========================
const API_BASE = "https://isjiee-next-api.xxx.workers.dev"; // ⚠️ remplace par ton vrai URL

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

  // 🔐 STOCKAGE
  localStorage.setItem("token", data.token);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));

  return data.user;
}

// =========================
// AUTH CHECK
// =========================
function isAuthenticated() {
  return !!localStorage.getItem("token");
}

// =========================
// LOGOUT
// =========================
function logout() {
  localStorage.clear();
  window.location.href = "/login.html";
}

// =========================
// GET USER
// =========================
function getUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

// =========================
// ROLE REDIRECT
// =========================
function redirectByRole(user) {

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

  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) return;

  try {

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken })
    });

    const data = await res.json();

    if (!res.ok) {
      logout();
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);

  } catch {
    logout();
  }
}

// =========================
// AUTO REFRESH (SILENCIEUX)
// =========================
function initAutoRefresh() {

  // refresh toutes les 10 minutes
  setInterval(() => {
    refreshToken();
  }, 10 * 60 * 1000);

}

// =========================
// AUTH HEADER HELPER
// =========================
function getAuthHeader() {
  const token = localStorage.getItem("token");

  return token
    ? { Authorization: "Bearer " + token }
    : {};
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
  getAuthHeader
};
