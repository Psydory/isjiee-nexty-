// frontend/js/auth.js
// Authentification frontend – version sécurisée (base64url, refresh proactif, timeout)

import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout } from '/js/api.js';

// =========================
// DÉCODAGE JWT (support base64url)
// =========================
function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// =========================
// STOCKAGE TOKEN
// =========================
function getToken() {
  return localStorage.getItem('token');
}

function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

function setTokens(token, refreshToken) {
  if (token) localStorage.setItem('token', token);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

// =========================
// ÉTAT UTILISATEUR
// =========================
let currentUser = null;
let authListeners = [];
let loadingPromise = null;
let refreshingPromise = null;

function notifyListeners() {
  authListeners.forEach(cb => {
    try {
      cb(currentUser);
    } catch (err) {
      console.error('Auth listener error:', err);
    }
  });
}

// =========================
// VÉRIFICATION EXPIRATION TOKEN (basée sur le payload décodé)
// =========================
function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload) return true;
  return payload.exp && payload.exp < Date.now() / 1000;
}

// =========================
// RAFRAÎCHISSEMENT TOKEN (avec timeout)
// =========================
async function refreshToken() {
  if (refreshingPromise) return refreshingPromise;
  refreshingPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.token) {
        setTokens(data.token, data.refreshToken || refresh);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Refresh token failed:', err);
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();
  return refreshingPromise;
}

// =========================
// CHARGEMENT DE L'UTILISATEUR (avec refresh si token expiré)
// =========================
export async function loadUser() {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    let token = getToken();
    if (!token) {
      currentUser = null;
      notifyListeners();
      return null;
    }

    // Si token expiré, tenter un refresh avant de tout effacer
    if (isTokenExpired(token)) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        clearTokens();
        currentUser = null;
        notifyListeners();
        return null;
      }
      token = getToken();
    }

    try {
      const response = await getMe();
      currentUser = response.user || response;
      notifyListeners();
      return currentUser;
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        clearTokens();
        currentUser = null;
        notifyListeners();
      }
      return null;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

// =========================
// VÉRIFICATIONS AUTH (avec refresh intelligent)
// =========================
export async function checkAuth() {
  let token = getToken();
  if (!token) return false;

  if (isTokenExpired(token)) {
    const refreshed = await refreshToken();
    if (!refreshed) return false;
  }
  if (!currentUser) await loadUser();
  return !!currentUser;
}

export function isAuthenticated() {
  const token = getToken();
  return !!(token && !isTokenExpired(token));
}

export function getUser() {
  return currentUser;
}

// =========================
// REDIRECTION CENTRALISÉE (évite les conflits)
// =========================
let redirectLock = false;
function navigateTo(url) {
  if (redirectLock) return;
  redirectLock = true;
  setTimeout(() => { redirectLock = false; }, 500);
  window.location.href = url;
}

// =========================
// LOGIN / REGISTER / LOGOUT (avec navigation centralisée)
// =========================
export async function login(email, password, redirectTo = '/dashboard.html') {
  try {
    const data = await apiLogin(email, password);
    if (data.token) {
      setTokens(data.token, data.refreshToken);
      await loadUser();
      notifyListeners();
      navigateTo(redirectTo);
      return { success: true, user: currentUser };
    }
    return { success: false, error: 'No token received' };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: err.message };
  }
}

const ALLOWED_FRONTEND_ROLES = ['student', 'entrepreneur', 'wiggfluenceur'];

export async function register(email, password, role = 'student', tier = 1, redirectTo = '/dashboard.html') {
  const safeRole = ALLOWED_FRONTEND_ROLES.includes(role) ? role : 'student';
  try {
    const data = await apiRegister(email, password, safeRole, tier);
    if (data.token) {
      setTokens(data.token, data.refreshToken);
      await loadUser();
      notifyListeners();
      navigateTo(redirectTo);
      return { success: true, user: currentUser };
    }
    return { success: false, error: 'No token received' };
  } catch (err) {
    console.error('Register error:', err);
    return { success: false, error: err.message };
  }
}

export async function logout(redirectTo = '/login.html') {
  try {
    await apiLogout();
  } catch (err) {
    console.warn('Logout API call failed', err);
  }
  clearTokens();
  currentUser = null;
  notifyListeners();
  navigateTo(redirectTo);
}

// =========================
// PROTECTION DES ROUTES (sans redirection multiple)
// =========================
export async function requireAuth(redirectTo = '/login.html') {
  const isAuth = await checkAuth();
  if (!isAuth && redirectTo) {
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    navigateTo(redirectTo);
    return false;
  }
  return isAuth;
}

export async function requireRole(allowedRoles, redirectTo = '/dashboard.html') {
  const isAuth = await checkAuth();
  if (!isAuth) {
    navigateTo('/login.html');
    return false;
  }
  if (currentUser && !allowedRoles.includes(currentUser.role)) {
    navigateTo(redirectTo);
    return false;
  }
  return true;
}

// =========================
// ÉCOUTEURS (avec désinscription possible)
// =========================
export function onAuthChange(callback, callImmediately = true) {
  authListeners.push(callback);
  if (callImmediately) callback(currentUser);
  return () => {
    authListeners = authListeners.filter(cb => cb !== callback);
  };
}

// =========================
// SYNCHRONISATION MULTI-ONGLETS
// =========================
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'token' || e.key === 'refreshToken') {
      if (!getToken()) {
        currentUser = null;
        notifyListeners();
      } else {
        loadUser();
      }
    }
  });
}

// =========================
// INITIALISATION AUTOMATIQUE (une seule fois)
// =========================
let initDone = false;
if (typeof window !== 'undefined' && !initDone) {
  initDone = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUser);
  } else {
    loadUser();
  }
}