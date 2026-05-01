import auth from "./authSystem.js";

// =========================
// PROTECT PAGE (AUTH)
// =========================
function requireAuth() {

  if (!auth.isAuthenticated()) {
    window.location.href = "/login.html";
    return false;
  }

  return true;
}

// =========================
// PROTECT ROLE
// =========================
function requireRole(role) {

  const user = auth.getUser();

  if (!user || user.role !== role) {
    window.location.href = "/dashboard.html";
    return false;
  }

  return true;
}

// =========================
// AUTO GUARD
// =========================
function initGuard(options = {}) {

  const { role } = options;

  if (!requireAuth()) return;

  if (role) {
    requireRole(role);
  }

  // 🔄 lance refresh auto
  auth.initAutoRefresh();
}

// =========================
// EXPORT
// =========================
export default {
  requireAuth,
  requireRole,
  initGuard
};