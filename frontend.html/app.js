// =========================
// IMPORTS
// =========================
import API from "./api-core.js";
import URLS from "./url.js";
import UI from "./uisystem.js";

// =========================
// APP CORE
// =========================
const App = {};

// =========================
// GLOBAL STATE
// =========================
App.state = {
  user: null,
  ready: false
};

// =========================
// INIT
// =========================
App.init = async () => {

  UI.init?.();

  App.bindGlobalEvents();

  await App.bootstrapAuth();

  App.protectRoutes();

  App.prefetchPages();

  App.state.ready = true;
};

// =========================
// AUTH BOOTSTRAP
// =========================
App.bootstrapAuth = async () => {

  const token = localStorage.getItem("token");

  if (!token) {
    App.state.user = null;
    return;
  }

  try {
    const res = await API.get(URLS.api.auth.me);
    App.state.user = res.user;

  } catch {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    App.state.user = null;
  }
};

// =========================
// ROUTE PROTECTION
// =========================
App.protectRoutes = () => {

  const path = window.location.pathname;

  const protectedPages = [
    URLS.pages.dashboard,
    URLS.pages.admin
  ];

  const adminPages = [
    URLS.pages.admin
  ];

  // NOT LOGGED
  if (!App.state.user && protectedPages.includes(path)) {
    UI.toast("Connexion requise", "error");
    return URLS.goLogin();
  }

  // NOT ADMIN
  if (
    App.state.user &&
    adminPages.includes(path) &&
    App.state.user.role !== "admin"
  ) {
    UI.toast("Accès refusé", "error");
    return URLS.goHome();
  }
};

// =========================
// PREFETCH (PERF)
// =========================
App.prefetchPages = () => {

  const links = [
    URLS.pages.gallery,
    URLS.pages.dashboard
  ];

  links.forEach(url => UI.prefetch(url));
};

// =========================
// GLOBAL EVENTS
// =========================
App.bindGlobalEvents = () => {

  // LOGOUT
  document.addEventListener("click", (e) => {
    if (e.target.matches("#logout")) {
      App.logout();
    }
  });

  // GLOBAL ERROR HANDLER
  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled:", e.reason);
    UI.toast("Erreur système", "error");
  });

  // OFFLINE / ONLINE
  window.addEventListener("offline", () => {
    UI.toast("Mode hors ligne", "error");
  });

  window.addEventListener("online", () => {
    UI.toast("Connexion rétablie", "success");
  });
};

// =========================
// AUTH ACTIONS
// =========================
App.login = async (email, password) => {

  const res = await UI.api(() =>
    API.post(URLS.api.auth.login, { email, password }),
    { loader: true }
  );

  API.setTokens(res);
  App.state.user = res.user;

  UI.toast("Connexion réussie");

  URLS.goDashboard();
};

App.logout = () => {
  API.clearTokens();
  App.state.user = null;

  UI.toast("Déconnecté");

  URLS.goHome();
};

// =========================
// USER HELPERS
// =========================
App.isAuth = () => !!App.state.user;
App.isAdmin = () => App.state.user?.role === "admin";

// =========================
// GUARD FUNCTION (OPTIONNEL)
// =========================
App.guard = (fn, { auth = false, admin = false } = {}) => {
  return (...args) => {

    if (auth && !App.isAuth()) {
      UI.toast("Connexion requise", "error");
      return URLS.goLogin();
    }

    if (admin && !App.isAdmin()) {
      UI.toast("Accès admin requis", "error");
      return;
    }

    return fn(...args);
  };
};

// =========================
// GLOBAL API WRAPPER
// =========================
App.api = (fn, options) => UI.api(fn, options);

// =========================
// EXPORT
// =========================
export default App;

// =========================
// AUTO INIT
// =========================
App.init();import Upload from "./upload.js";

// dans App.init()
Upload.init();