// =========================
// IMPORT
// =========================
import auth from "./authSystem.js";
import UI from "./uisystem.js";

// =========================
// HELPERS
// =========================
function redirect(path) {
  window.location.href = path;
}

// =========================
// AUTH CHECK (ROBUSTE)
// =========================
function requireAuth({ silent = false } = {}) {

  const isAuth = auth.isAuthenticated();
  const user = auth.getUser();

  if (!isAuth || !user) {

    if (!silent) {
      UI.toast("Connexion requise", "error");
    }

    redirect("/login.html");
    return false;
  }

  return true;
}

// =========================
// ROLE CHECK (MULTI SUPPORT)
// =========================
function requireRole(roles = [], { silent = false } = {}) {

  const user = auth.getUser();

  if (!user) {
    return requireAuth({ silent });
  }

  // accepte string ou array
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role)) {

    if (!silent) {
      UI.toast("Accès refusé", "error");
    }

    redirect("/dashboard.html");
    return false;
  }

  return true;
}

// =========================
// MAIN GUARD
// =========================
function initGuard(options = {}) {

  const {
    authRequired = true,
    role = null,
    silent = false
  } = options;

  // =========================
  // AUTH CHECK
  // =========================
  if (authRequired) {
    const ok = requireAuth({ silent });
    if (!ok) return false;
  }

  // =========================
  // ROLE CHECK
  // =========================
  if (role) {
    const ok = requireRole(role, { silent });
    if (!ok) return false;
  }

  // =========================
  // AUTO REFRESH (SAFE)
  // =========================
  if (auth.isAuthenticated()) {
    auth.initAutoRefresh?.();
  }

  return true;
}

// =========================
// OPTIONAL WRAPPER (ADVANCED)
// =========================
function guardRoute(fn, options = {}) {

  return (...args) => {

    const ok = initGuard(options);

    if (!ok) return;

    return fn(...args);
  };
}

// =========================
// EXPORT
// =========================
export default {
  requireAuth,
  requireRole,
  initGuard,
  guardRoute
};