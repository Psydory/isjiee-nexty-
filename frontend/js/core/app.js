// frontend/js/app.js
// Initialisation globale : menu, auth, toasts, etc.

import { getUser, onAuthChange, logout } from './auth.js';
import { showToast } from './ui.js';

// =========================
// SINGLETON (évite double initialisation)
// =========================
if (!window.__APP_INITIALIZED__) {
  window.__APP_INITIALIZED__ = true;
} else {
  // Déjà initialisé, on ne fait rien
  console.debug('App already initialized');
}

// =========================
// MENU HAMBURGER (mobile)
// =========================
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (!hamburger || !navLinks) return;

  // Supprimer les anciens écouteurs pour éviter les doublons (safe)
  const newHamburger = hamburger.cloneNode(true);
  hamburger.parentNode.replaceChild(newHamburger, hamburger);
  const newNavLinks = navLinks.cloneNode(true);
  navLinks.parentNode.replaceChild(newNavLinks, navLinks);

  newHamburger.addEventListener('click', () => {
    newNavLinks.classList.toggle('active');
    newHamburger.setAttribute('aria-expanded', newNavLinks.classList.contains('active'));
  });

  newNavLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      newNavLinks.classList.remove('active');
      newHamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

// =========================
// METTRE À JOUR L'INTERFACE UTILISATEUR DANS LA NAVBAR
// =========================
function updateUserUI(user) {
  const userMenu = document.getElementById('userMenu');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');

  if (user) {
    // Utilisateur connecté
    if (userMenu) {
      userMenu.textContent = user.email || ''; // ✅ correction
      userMenu.style.display = 'inline-block';
    }
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';
  } else {
    // Utilisateur non connecté
    if (userMenu) userMenu.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginLink) loginLink.style.display = 'inline-block';
    if (registerLink) registerLink.style.display = 'inline-block';
  }
}

// =========================
// DÉCONNEXION (avec délai pour voir le toast)
// =========================
function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    // Nettoyer l'ancien écouteur
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    newLogoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logout();
      showToast('Déconnexion réussie', 'success');
      // Redirection après 1 seconde pour que le toast soit visible
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    });
  }
}

// =========================
// FERMETURE DES TOASTS AU CLIC
// =========================
function initToastDismiss() {
  document.addEventListener('click', (e) => {
    const toast = document.getElementById('toast');
    if (toast && e.target === toast) {
      toast.style.display = 'none';
    }
  });
}

// =========================
// INITIALISATION GLOBALE (avec gestion d'erreurs)
// =========================
async function init() {
  try {
    initMobileMenu();
    initLogout();
    initToastDismiss();

    // Écouter les changements d'authentification
    onAuthChange((user) => {
      updateUserUI(user);
    });

    // Charger l'utilisateur une fois au démarrage
    const user = getUser();
    updateUserUI(user);
  } catch (err) {
    console.error('[APP INIT ERROR]', err);
    // Optionnel : afficher un toast d'erreur
    if (typeof showToast === 'function') {
      showToast('Erreur lors de l\'initialisation', 'error');
    }
  }
}

// Démarrer quand le DOM est prêt (avec protection singleton)
if (window.__APP_INITIALIZED__) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}