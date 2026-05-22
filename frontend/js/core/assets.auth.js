// =========================
// assets/js/auth.js
// AUTHENTIFICATION CLIENT - VERSION FINALE COMPLÈTE
// =========================

import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout } from './api.js';

// =========================
// ÉTAT LOCAL
// =========================
let currentUser = null;
let authListeners = [];

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
// VÉRIFICATION EXPIRATION TOKEN
// =========================
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return true;
    }
  } catch (err) {
    return true;
  }
  return false;
}

function getTokenExpiration(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// =========================
// NOTIFICATION DES CHANGEMENTS
// =========================
function notifyAuthListeners() {
  for (const listener of authListeners) {
    try {
      listener(currentUser);
    } catch (err) {
      console.error('Auth listener error:', err);
    }
  }
}

// =========================
// CHARGEMENT UTILISATEUR DEPUIS TOKEN
// =========================
export async function loadUser() {
  const token = getToken();
  if (!token) {
    currentUser = null;
    notifyAuthListeners();
    return null;
  }
  
  // Vérifier expiration token avant appel API
  if (isTokenExpired(token)) {
    clearTokens();
    currentUser = null;
    notifyAuthListeners();
    return null;
  }
  
  try {
    const response = await getMe();
    // Gérer les deux formats possibles
    currentUser = response.user || response;
    notifyAuthListeners();
    return currentUser;
  } catch (err) {
    console.error('Load user error:', err);
    // Token invalide ou expiré
    clearTokens();
    currentUser = null;
    notifyAuthListeners();
    return null;
  }
}

// =========================
// VÉRIFICATION AUTHENTIFICATION
// =========================
export async function checkAuth() {
  const token = getToken();
  if (!token) return false;
  
  // Vérifier expiration
  if (isTokenExpired(token)) {
    clearTokens();
    currentUser = null;
    return false;
  }
  
  if (!currentUser) {
    await loadUser();
  }
  
  return !!currentUser;
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  
  // Vérifier expiration synchronement
  if (isTokenExpired(token)) {
    return false;
  }
  
  return !!currentUser;
}

export function getUser() {
  return currentUser;
}

export function getTokenInfo() {
  const token = getToken();
  if (!token) return null;
  return {
    token,
    expired: isTokenExpired(token),
    expiresAt: getTokenExpiration(token)
  };
}

// =========================
// VÉRIFICATION ANTI-ROBOT (améliorée)
// =========================
export function verifyAntiBot() {
  // Vérification simple: temps de chargement de la page
  const startTime = window.performance?.timing?.navigationStart || Date.now();
  const loadTime = Date.now() - startTime;
  
  // Si la page charge trop vite (< 50ms), suspect (bot)
  if (loadTime < 50) {
    console.warn('Anti-bot: Page loaded too fast');
    return false;
  }
  
  // Vérification sessionStorage avec hash
  const antiBotPassed = sessionStorage.getItem('antiBotPassed');
  if (antiBotPassed) {
    try {
      const data = JSON.parse(atob(antiBotPassed));
      if (data.expires > Date.now()) {
        return true;
      }
    } catch {
      // Hash invalide, continuer
    }
  }
  
  // Générer un nouveau hash valide pour 24h
  const hashData = {
    timestamp: Date.now(),
    expires: Date.now() + 24 * 60 * 60 * 1000,
    ua: navigator.userAgent.substring(0, 50)
  };
  const hash = btoa(JSON.stringify(hashData));
  sessionStorage.setItem('antiBotPassed', hash);
  
  return true;
}

// =========================
// LOGIN
// =========================
export async function login(email, password, redirectTo = '/dashboard.html') {
  try {
    const data = await apiLogin(email, password);
    
    // Vérifier que le token est présent
    if (!data.token) {
      return { success: false, error: 'No token received from server' };
    }
    
    setTokens(data.token, data.refreshToken);
    await loadUser();
    notifyAuthListeners();
    
    // Rediriger seulement si demandé et pas déjà sur la page
    if (redirectTo && window.location.pathname !== redirectTo) {
      window.location.href = redirectTo;
    }
    return { success: true, user: currentUser };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: err.message || 'Login failed' };
  }
}

// =========================
// REGISTER
// =========================
export async function register(email, password, role = 'student', redirectTo = '/dashboard.html') {
  try {
    const data = await apiRegister(email, password, role);
    
    if (!data.token) {
      return { success: false, error: 'No token received from server' };
    }
    
    setTokens(data.token, data.refreshToken);
    await loadUser();
    notifyAuthListeners();
    
    if (redirectTo && window.location.pathname !== redirectTo) {
      window.location.href = redirectTo;
    }
    return { success: true, user: currentUser };
  } catch (err) {
    console.error('Register error:', err);
    return { success: false, error: err.message || 'Registration failed' };
  }
}

// =========================
// LOGOUT
// =========================
export async function logout(redirectTo = '/login.html') {
  try {
    await apiLogout();
  } catch (err) {
    // Ignorer les erreurs de logout
  }
  
  clearTokens();
  currentUser = null;
  notifyAuthListeners();
  
  if (redirectTo && window.location.pathname !== redirectTo) {
    window.location.href = redirectTo;
  }
}

// =========================
// INSCRIPTION DES ÉCOUTEURS
// =========================
export function onAuthChange(callback, callImmediately = true) {
  if (typeof callback !== 'function') {
    console.warn('onAuthChange: callback must be a function');
    return () => {};
  }
  
  authListeners.push(callback);
  if (callImmediately) {
    callback(currentUser);
  }
  
  // Retourner fonction pour se désinscrire
  return () => {
    authListeners = authListeners.filter(cb => cb !== callback);
  };
}

// =========================
// PROTECTION DES ROUTES
// =========================
export async function requireAuth(redirectTo = '/login.html') {
  const isAuth = await checkAuth();
  if (!isAuth && redirectTo && window.location.pathname !== redirectTo) {
    const currentPath = window.location.pathname;
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    window.location.href = redirectTo;
    return false;
  }
  return isAuth;
}

export async function requireRole(allowedRoles, redirectTo = '/dashboard.html') {
  const isAuth = await checkAuth();
  if (!isAuth) {
    window.location.href = '/login.html';
    return false;
  }
  
  if (currentUser && !allowedRoles.includes(currentUser.role)) {
    if (redirectTo && window.location.pathname !== redirectTo) {
      window.location.href = redirectTo;
    }
    return false;
  }
  
  return true;
}

// =========================
// ADMIN PROTECTION
// =========================
export async function requireAdmin(redirectTo = '/dashboard.html') {
  return requireRole(['admin', 'super_admin'], redirectTo);
}

// =========================
// RÉCUPÉRATION DU RÉDIRECTION STOCKÉE
// =========================
export function getRedirectAfterLogin() {
  const redirect = sessionStorage.getItem('redirectAfterLogin');
  sessionStorage.removeItem('redirectAfterLogin');
  return redirect || '/dashboard.html';
}

// =========================
// RAFFRAÎCHISSEMENT DU TOKEN (manuel)
// =========================
export async function refreshAuth() {
  const token = getToken();
  if (!token) return false;
  
  if (isTokenExpired(token)) {
    clearTokens();
    currentUser = null;
    return false;
  }
  
  await loadUser();
  return !!currentUser;
}

// =========================
// NETTOYAGE SESSION
// =========================
export function clearSession() {
  clearTokens();
  currentUser = null;
  notifyAuthListeners();
  sessionStorage.clear();
}

// =========================
// INITIALISATION AUTOMATIQUE
// =========================
// Charge l'utilisateur au démarrage si un token existe
if (typeof window !== 'undefined') {
  // Attendre que la page soit chargée
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadUser();
    });
  } else {
    loadUser();
  }
}

// =========================
// EXPORTS PAR DÉFAUT
// =========================
export default {
  // Auth principaux
  login,
  register,
  logout,
  // État
  getUser,
  getToken,
  getRefreshToken,
  getTokenInfo,
  isAuthenticated,
  checkAuth,
  loadUser,
  refreshAuth,
  // Protection routes
  requireAuth,
  requireRole,
  requireAdmin,
  // Utilitaires
  onAuthChange,
  verifyAntiBot,
  getRedirectAfterLogin,
  clearSession
};