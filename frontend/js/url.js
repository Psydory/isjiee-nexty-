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

// ⚠️ IMPORTANT
// 👉 remplace en prod par ton vrai worker
// ex: https://isjiee-next-api.workers.dev
URLS.base = isLocal
  ? "http://127.0.0.1:8787"
  : "https://isjiee-next-api.workers.dev";

// =========================
// API VERSIONING
// =========================
URLS.version = "/api/v1";

// =========================
// SAFE BUILDER
// =========================
URLS.build = (path = "") => {

  const cleanBase = URLS.base.replace(/\/$/, "");
  const cleanVersion = URLS.version.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : "/" + path;

  return `${cleanBase}${cleanVersion}${cleanPath}`;
};

// =========================
// FRONTEND ROUTES
// =========================
URLS.pages = {
  home: "/index.html",
  gallery: "/gallery.html",
  dashboard: "/dashboard.html",
  admin: "/admin.html",
  login: "/login.html",
  register: "/register.html"
};

// =========================
// API ROUTES
// =========================
URLS.api = {

  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    me: "/auth/me" // ✅ corrigé
  },

  media: {
    base: "/media",
    public: "/media?mode=public",
    trending: "/media/trending",
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
// QUERY BUILDER (ROBUST)
// =========================
URLS.query = (path, params = {}) => {

  const url = new URL(path, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.pathname + url.search;
};

// =========================
// FULL URL (OPTIONNEL)
// =========================
URLS.full = (path, params = {}) => {
  return URLS.build(URLS.query(path, params));
};

// =========================
// EXPORT
// =========================
export default URLS;