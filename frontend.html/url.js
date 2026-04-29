// =========================
// ENV DETECTION
// =========================
const isLocal =
  location.hostname.includes("localhost") ||
  location.hostname.includes("127.0.0.1");

// =========================
// BASE CONFIG
// =========================
const URLS = {};

// domaine API selon environnement
URLS.base = isLocal
  ? "http://127.0.0.1:8787"
  : ""; // production = même domaine

// version API
URLS.version = "/api/v1";

// builder complet
URLS.build = (path) => {
  return URLS.base + URLS.version + path;
};

// =========================
// FRONTEND ROUTES
// =========================
URLS.pages = {
  home: "/index.html",
  gallery: "/gallery.html",
  dashboard: "/dashboard.html",
  admin: "/admin.html",
  login: "/login.html"
};

// =========================
// API ROUTES
// =========================
URLS.api = {

  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    me: "/me"
  },

  media: {
    base: "/media",
    public: "/media?mode=public",
    delete: "/media/delete",
    uploadUrl: "/media/upload-url",
    validate: "/media/validate",
    like: "/media/like",
    view: "/media/view"
  },

  admin: {
    media: "/admin/media",
    moderate: "/admin/media/moderate",
    feature: "/admin/media/feature",
    users: "/admin/users",
    ban: "/admin/users/ban",
    stats: "/admin/stats"
  }
};

// =========================
// NAVIGATION
// =========================
URLS.go = (path) => {
  window.location.href = path;
};

URLS.goHome = () => URLS.go(URLS.pages.home);
URLS.goGallery = () => URLS.go(URLS.pages.gallery);
URLS.goDashboard = () => URLS.go(URLS.pages.dashboard);
URLS.goAdmin = () => URLS.go(URLS.pages.admin);
URLS.goLogin = () => URLS.go(URLS.pages.login);

// =========================
// QUERY BUILDER
// =========================
URLS.query = (base, params = {}) => {

  const url = new URL(base, window.location.origin);

  Object.keys(params).forEach(key => {
    if (params[key] !== undefined) {
      url.searchParams.set(key, params[key]);
    }
  });

  return url.pathname + url.search;
};

// =========================
// EXPORT
// =========================
export default URLS;