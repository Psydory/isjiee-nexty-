// =========================
// frontend/js/admin.js
// PANEL ADMIN – VERSION PRODUCTION (CORRIGÉE)
// =========================

import { requireAuth, getUser } from '/js/auth.js';
import {
  getAdminStats,
  getAllMediaAdmin,
  moderateMedia,
  featureMedia,
  getUsersAdmin,
  banUser
} from '/js/api.js';

// =========================
// ÉTAT LOCAL
// =========================
let statsContainer = null;
let mediaContainer = null;
let usersContainer = null;

let mediaPage = 1;
let usersPage = 1;
const MEDIA_LIMIT = 20;
const USERS_LIMIT = 20;

// =========================
// TOAST (fallback si window.showToast n’existe pas)
// =========================
function showMessage(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    alert(message);
  }
}

// =========================
// CHARGEMENT DES STATISTIQUES
// =========================
async function loadStats() {
  if (!statsContainer) return;
  try {
    const stats = await getAdminStats();
    statsContainer.innerHTML = `
      <div class="stat-card">📊 Médias: ${stats.stats.media}</div>
      <div class="stat-card">👥 Utilisateurs: ${stats.stats.users}</div>
      <div class="stat-card">⭐ Mis en avant: ${stats.stats.featured}</div>
      <div class="stat-card">⏳ En attente: ${stats.stats.pending}</div>
    `;
  } catch (err) {
    statsContainer.innerHTML = '<div class="error">Erreur chargement stats</div>';
    console.error(err);
  }
}

// =========================
// MODÉRATION D'UN MÉDIA (avec confirmation + désactivation du bouton)
// =========================
async function moderateMediaHandler(mediaId, status, btn) {
  if (!confirm(`✅❌ Confirmer la modération du média ${mediaId} (${status}) ?`)) return;
  if (btn) btn.disabled = true;
  try {
    await moderateMedia(mediaId, status);
    showMessage(`Média ${mediaId} ${status === 'approved' ? 'approuvé' : 'rejeté'}`, 'success');
    // Recharger les listes et les stats
    await Promise.all([loadMedia(mediaPage), loadStats()]);
  } catch (err) {
    showMessage('Erreur lors de la modération', 'error');
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function featureMediaHandler(mediaId, btn) {
  if (!confirm(`⭐ Mettre en avant le média ${mediaId} ?`)) return;
  if (btn) btn.disabled = true;
  try {
    await featureMedia(mediaId, true);
    showMessage(`Média ${mediaId} mis en avant`, 'success');
    await loadMedia(mediaPage);
  } catch (err) {
    showMessage('Erreur lors de la mise en avant', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// =========================
// AFFICHAGE DES MÉDIAS (avec pagination)
// =========================
async function loadMedia(page = 1) {
  if (!mediaContainer) return;
  mediaPage = page;
  try {
    const data = await getAllMediaAdmin(page, MEDIA_LIMIT);
    const mediaList = data.media || [];
    const total = data.pagination?.total || 0;
    const totalPages = Math.ceil(total / MEDIA_LIMIT);

    if (mediaList.length === 0) {
      mediaContainer.innerHTML = '<p>Aucun média à modérer.</p>';
      return;
    }

    mediaContainer.innerHTML = mediaList.map(media => `
      <div class="media-card" data-id="${media.id}">
        <div><strong>${escapeHtml(media.title || 'Sans titre')}</strong> (${media.type})</div>
        <div>Utilisateur: ${escapeHtml(media.user_email || media.user_id)}</div>
        <div>Statut: ${media.status}</div>
        <div>
          <button class="approve-btn" data-id="${media.id}">✅ Approuver</button>
          <button class="reject-btn" data-id="${media.id}">❌ Rejeter</button>
          <button class="feature-btn" data-id="${media.id}">⭐ Mettre en avant</button>
        </div>
      </div>
    `).join('');

    // Ajouter la pagination si nécessaire
    if (totalPages > 1) {
      const paginationDiv = document.createElement('div');
      paginationDiv.className = 'pagination';
      paginationDiv.innerHTML = `
        <button class="prev-page" ${page === 1 ? 'disabled' : ''}>◀ Précédent</button>
        <span>Page ${page} / ${totalPages}</span>
        <button class="next-page" ${page === totalPages ? 'disabled' : ''}>Suivant ▶</button>
      `;
      mediaContainer.appendChild(paginationDiv);
      paginationDiv.querySelector('.prev-page')?.addEventListener('click', () => loadMedia(page - 1));
      paginationDiv.querySelector('.next-page')?.addEventListener('click', () => loadMedia(page + 1));
    }

    // Attacher les événements (avec délégation possible, mais on le fait directement)
    document.querySelectorAll('.approve-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        const id = newBtn.dataset.id;
        moderateMediaHandler(id, 'approved', newBtn);
      });
    });
    document.querySelectorAll('.reject-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        const id = newBtn.dataset.id;
        moderateMediaHandler(id, 'rejected', newBtn);
      });
    });
    document.querySelectorAll('.feature-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        const id = newBtn.dataset.id;
        featureMediaHandler(id, newBtn);
      });
    });
  } catch (err) {
    mediaContainer.innerHTML = '<div class="error">Erreur chargement médias</div>';
    console.error(err);
  }
}

// =========================
// BAN / UNBAN D'UN UTILISATEUR
// =========================
async function banUserHandler(userId, currentlyBanned, btn) {
  const action = currentlyBanned ? 'débannir' : 'bannir';
  if (!confirm(`Confirmer le ${action} de l'utilisateur ${userId} ?`)) return;
  if (btn) btn.disabled = true;
  try {
    await banUser(userId, !currentlyBanned);
    showMessage(`Utilisateur ${userId} ${action === 'bannir' ? 'banni' : 'débanni'}`, 'success');
    await loadUsers(usersPage);
  } catch (err) {
    showMessage(`Erreur lors du ${action}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// =========================
// AFFICHAGE DES UTILISATEURS (avec pagination)
// =========================
async function loadUsers(page = 1) {
  if (!usersContainer) return;
  usersPage = page;
  try {
    const data = await getUsersAdmin(page, USERS_LIMIT);
    const users = data.users || [];
    const total = data.pagination?.total || 0;
    const totalPages = Math.ceil(total / USERS_LIMIT);

    if (users.length === 0) {
      usersContainer.innerHTML = '<p>Aucun utilisateur.</p>';
      return;
    }

    usersContainer.innerHTML = users.map(user => `
      <div class="user-card" data-id="${user.id}">
        <div><strong>${escapeHtml(user.email)}</strong> (${user.role})</div>
        <div>Banni: ${user.banned ? 'Oui' : 'Non'}</div>
        <div>
          <button class="ban-btn" data-id="${user.id}" data-banned="${user.banned}">
            ${user.banned ? '🔓 Débannir' : '🔨 Bannir'}
          </button>
        </div>
      </div>
    `).join('');

    if (totalPages > 1) {
      const paginationDiv = document.createElement('div');
      paginationDiv.className = 'pagination';
      paginationDiv.innerHTML = `
        <button class="prev-page" ${page === 1 ? 'disabled' : ''}>◀ Précédent</button>
        <span>Page ${page} / ${totalPages}</span>
        <button class="next-page" ${page === totalPages ? 'disabled' : ''}>Suivant ▶</button>
      `;
      usersContainer.appendChild(paginationDiv);
      paginationDiv.querySelector('.prev-page')?.addEventListener('click', () => loadUsers(page - 1));
      paginationDiv.querySelector('.next-page')?.addEventListener('click', () => loadUsers(page + 1));
    }

    // Attacher événements avec clonage pour éviter les doublons
    document.querySelectorAll('.ban-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      const userId = newBtn.dataset.id;
      const isBanned = newBtn.dataset.banned === '1' || newBtn.dataset.banned === 'true';
      newBtn.addEventListener('click', () => banUserHandler(userId, isBanned, newBtn));
    });
  } catch (err) {
    usersContainer.innerHTML = '<div class="error">Erreur chargement utilisateurs</div>';
    console.error(err);
  }
}

// =========================
// ESCAPE HTML (protection XSS)
// =========================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// =========================
// INITIALISATION
// =========================
async function initAdmin() {
  // Authentification et autorisation
  const isAuth = await requireAuth('/login.html');
  if (!isAuth) return;
  const user = getUser();
  if (!user || user.role !== 'admin') {
    showMessage('Accès réservé aux administrateurs.', 'error');
    window.location.href = '/index.html';
    return;
  }

  statsContainer = document.getElementById('stats');
  mediaContainer = document.getElementById('media');
  usersContainer = document.getElementById('users');

  if (statsContainer) loadStats();
  if (mediaContainer) loadMedia(1);
  if (usersContainer) loadUsers(1);
}

// Démarrer
initAdmin();