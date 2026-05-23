// =========================
// assets/js/dashboard.js
// DASHBOARD PRINCIPAL - AVEC MODULES QUIZ, TIMER, AGENDA, ANT-GAME
// =========================

// =========================
// IMPORTS
// =========================
import { 
  requireAuth, 
  getUser, 
  onAuthChange, 
  logout,
  getTokenInfo
} from './auth.js';

import {
  getBalance,
  getLevelInfo,
  getTasks,
  submitTask,
  getSubscriptionStatus,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getMediaGallery,
  likeMedia,
  addView
} from './api.js';

// Modules frontend
import { initQuiz } from './modules/quiz.js';
import { initTimer } from './modules/timer.js';
import { initAgenda } from './modules/agenda.js';
import { initAntGame } from './modules/ant-game.js';

// =========================
// ÉTAT GLOBAL DU DASHBOARD
// =========================
let currentUser = null;
let currentLevel = null;
let currentTasks = [];
let currentProjects = [];
let refreshInterval = null;

// =========================
// ÉLÉMENTS DOM
// =========================
const elements = {};

const REQUIRED_IDS = ['userEmail', 'tasksList'];
const OPTIONAL_IDS = [
  'userRole', 'userLevel', 'points', 'balance', 'progressFill', 'nextLevelInfo',
  'projectsList', 'taskType', 'taskDescription', 'submitTaskBtn',
  'newProjectBtn', 'projectForm', 'saveProjectBtn', 'cancelProjectBtn',
  'projectTitle', 'projectType', 'budgetModel', 'projectDesc',
  'logoutBtn', 'refreshBtn', 'userPhase', 'phaseRemaining'
];

function cacheElements() {
  for (const id of OPTIONAL_IDS) {
    elements[id] = document.getElementById(id);
  }
  for (const id of REQUIRED_IDS) {
    elements[id] = document.getElementById(id);
    if (!elements[id]) console.error(`❌ Critical element #${id} not found`);
  }
}

// =========================
// FORMATAGE & UTILITAIRES
// =========================
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  try {
    return new Date(timestamp).toLocaleDateString('fr-FR');
  } catch {
    return 'N/A';
  }
}

function formatPoints(points) {
  const num = parseInt(points) || 0;
  return new Intl.NumberFormat('fr-FR').format(num);
}

function getStatusText(status) {
  const map = {
    pending: '⏳ En attente',
    approved: '✅ Validé',
    rejected: '❌ Rejeté',
    active: '🟢 Actif',
    completed: '🏆 Terminé',
    paused: '⏸ En pause'
  };
  return map[status] || status;
}

function getStatusClass(status) {
  const map = {
    pending: 'status-pending',
    approved: 'status-approved',
    rejected: 'status-rejected',
    active: 'status-active',
    completed: 'status-completed',
    paused: 'status-paused'
  };
  return map[status] || '';
}

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateDescription(desc) {
  if (!desc) return false;
  if (desc.length > 2000) return false;
  if (/<script/i.test(desc)) return false;
  return true;
}

let toastTimeout = null;
function showToast(message, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.innerHTML = escapeHtml(message);
  toast.style.display = 'block';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// =========================
// NIVEAUX BAR
// =========================
const LEVELS = [
  { name: "Green Star", points: 0, icon: "🌟", color: "#10b981" },
  { name: "Blue Star", points: 5000, icon: "💙", color: "#3b82f6" },
  { name: "Gold Star", points: 10000, icon: "⭐", color: "#f59e0b" },
  { name: "Lead Star", points: 15000, icon: "✨", color: "#a855f7" },
  { name: "Mentor", points: 20000, icon: "🎓", color: "#ec4899" },
  { name: "Crystal Mag", points: 25000, icon: "🔮", color: "#06b6d4" }
];

function updateLevelDisplay(points) {
  if (!elements.userLevel || !elements.progressFill || !elements.nextLevelInfo) return;
  const safePoints = Math.max(0, points || 0);
  let current = LEVELS[0];
  let next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (safePoints >= LEVELS[i].points) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  let progress = 100;
  if (next && next.points > current.points) {
    const range = next.points - current.points;
    const achieved = safePoints - current.points;
    progress = (achieved / range) * 100;
    progress = Math.max(0, Math.min(100, progress));
  }
  elements.userLevel.innerHTML = `${current.icon} ${escapeHtml(current.name)}`;
  elements.progressFill.style.width = `${progress}%`;
  if (next) {
    elements.nextLevelInfo.innerText = `Prochain niveau : ${next.icon} ${escapeHtml(next.name)} (${formatPoints(safePoints)}/${formatPoints(next.points)} points)`;
  } else {
    elements.nextLevelInfo.innerText = '🏆 Niveau maximum atteint !';
  }
}

// =========================
// GESTION DES ERREURS API
// =========================
async function handleApiError(err, defaultMessage) {
  if (err.status === 401) {
    showToast('Session expirée, redirection...', 'warning');
    logout();
    return true;
  }
  console.error(defaultMessage, err);
  showToast(defaultMessage, 'error');
  return false;
}

// =========================
// CHARGEMENT DES DONNÉES
// =========================
async function loadUserData() {
  if (!currentUser) return;
  try {
    const [balance, levelInfo, subscription] = await Promise.all([
      getBalance().catch(() => ({ balance: 0, available: 0 })),
      getLevelInfo().catch(() => ({ points: 0, currentLevel: 'Green Star', progress: 0 })),
      getSubscriptionStatus().catch(() => ({ phase: 'trial', trialEnds: null }))
    ]);
    if (elements.userEmail) elements.userEmail.innerText = escapeHtml(currentUser.email);
    if (elements.userRole) elements.userRole.innerText = currentUser.role === 'student' ? 'Étudiant' : escapeHtml(currentUser.role);
    const points = levelInfo.points || 0;
    if (elements.points) elements.points.innerText = formatPoints(points);
    const balanceAmount = balance.balance ?? balance.available ?? 0;
    if (elements.balance) elements.balance.innerText = formatPoints(balanceAmount);
    currentLevel = levelInfo;
    updateLevelDisplay(points);
    if (elements.userPhase) {
      elements.userPhase.innerText = subscription.phase === 'paid' ? '✅ Abonnement actif' : '📋 Période d\'essai';
    }
    if (elements.phaseRemaining && subscription.trialEnds) {
      const daysLeft = Math.ceil((subscription.trialEnds - Date.now()) / (1000 * 60 * 60 * 24));
      elements.phaseRemaining.innerText = ` (${Math.max(0, daysLeft)} jours restants)`;
    }
  } catch (err) {
    await handleApiError(err, 'Erreur lors du chargement des données');
  }
}

async function loadTasks() {
  try {
    const tasks = await getTasks('pending');
    currentTasks = tasks.tasks || [];
    renderTasks();
  } catch (err) {
    const handled = await handleApiError(err, 'Erreur chargement tâches');
    if (!handled && elements.tasksList) {
      elements.tasksList.innerHTML = '<p class="error">❌ Erreur chargement tâches</p>';
    }
  }
}

async function loadProjects() {
  try {
    const projects = await getProjects();
    currentProjects = projects.projects || [];
    renderProjects();
  } catch (err) {
    const handled = await handleApiError(err, 'Erreur chargement projets');
    if (!handled && elements.projectsList) {
      elements.projectsList.innerHTML = '<p class="error">❌ Erreur chargement projets</p>';
    }
  }
}

// =========================
// RENDU DES COMPOSANTS
// =========================
function renderTasks() {
  if (!elements.tasksList) return;
  if (!currentTasks || currentTasks.length === 0) {
    elements.tasksList.innerHTML = '<p class="empty">✨ Aucune tâche en attente. Bravo !</p>';
    return;
  }
  elements.tasksList.innerHTML = currentTasks.map(task => `
    <div class="task-item" data-task-id="${escapeHtml(task.id)}">
      <div class="task-info">
        <strong>${escapeHtml(task.type)}</strong>
        <small>${escapeHtml(task.description || 'Aucune description')}</small>
        <small class="task-date">Soumis le ${formatDate(task.created_at)}</small>
      </div>
      <div class="task-status ${getStatusClass(task.status)}">
        ${getStatusText(task.status)}
      </div>
    </div>
  `).join('');
}

function renderProjects() {
  if (!elements.projectsList) return;
  if (!currentProjects || currentProjects.length === 0) {
    elements.projectsList.innerHTML = '<p class="empty">📁 Aucun projet. Créez votre premier projet !</p>';
    return;
  }
  elements.projectsList.innerHTML = currentProjects.map(project => `
    <div class="project-item" data-project-id="${escapeHtml(project.id)}">
      <div class="project-header">
        <h4>${escapeHtml(project.title)}</h4>
        <span class="project-type ${escapeHtml(project.type)}">${escapeHtml(project.type)}</span>
      </div>
      <div class="project-body">
        <p>${escapeHtml(project.description || 'Aucune description')}</p>
        <div class="project-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, project.progress || 0))}%"></div>
          </div>
          <span>${project.progress || 0}%</span>
        </div>
        <div class="project-meta">
          <span class="status ${project.status}">${getStatusText(project.status)}</span>
          <span class="date">Créé le ${formatDate(project.created_at)}</span>
        </div>
      </div>
      <div class="project-actions">
        <button class="btn-update-project" data-id="${escapeHtml(project.id)}">✏️ Modifier</button>
        <button class="btn-delete-project" data-id="${escapeHtml(project.id)}">🗑️ Supprimer</button>
      </div>
    </div>
  `).join('');
  attachProjectEvents();
}

function attachProjectEvents() {
  document.querySelectorAll('.btn-update-project').forEach(btn => {
    btn.removeEventListener('click', handleUpdateProject);
    btn.addEventListener('click', handleUpdateProject);
  });
  document.querySelectorAll('.btn-delete-project').forEach(btn => {
    btn.removeEventListener('click', handleDeleteProject);
    btn.addEventListener('click', handleDeleteProject);
  });
}

async function handleUpdateProject(e) {
  const projectId = e.currentTarget.dataset.id;
  const project = currentProjects.find(p => p.id === projectId);
  if (!project) return;
  const newProgress = prompt('Nouveau pourcentage de progression (0-100):', project.progress);
  if (newProgress !== null) {
    const progress = parseInt(newProgress);
    if (!isNaN(progress) && progress >= 0 && progress <= 100) {
      try {
        await updateProject(projectId, { progress });
        showToast('Projet mis à jour', 'success');
        await loadProjects();
      } catch (err) {
        await handleApiError(err, 'Erreur lors de la mise à jour');
      }
    } else {
      showToast('Veuillez entrer un nombre entre 0 et 100', 'error');
    }
  }
}

async function handleDeleteProject(e) {
  const projectId = e.currentTarget.dataset.id;
  if (confirm('Supprimer ce projet ?')) {
    try {
      await deleteProject(projectId);
      showToast('Projet supprimé', 'success');
      await loadProjects();
    } catch (err) {
      await handleApiError(err, 'Erreur lors de la suppression');
    }
  }
}

// =========================
// SOUMISSION TÂCHE
// =========================
async function handleSubmitTask() {
  const type = elements.taskType?.value;
  const description = elements.taskDescription?.value.trim();
  if (!type) {
    showToast('Veuillez sélectionner un type de tâche', 'error');
    return;
  }
  if (!description) {
    showToast('Veuillez décrire votre tâche', 'error');
    return;
  }
  if (!validateDescription(description)) {
    showToast('Description invalide (max 2000 caractères)', 'error');
    return;
  }
  const submitBtn = elements.submitTaskBtn;
  const originalText = submitBtn?.innerHTML;
  if (submitBtn) {
    submitBtn.innerHTML = '⏳ Envoi...';
    submitBtn.disabled = true;
  }
  try {
    await submitTask(type, description);
    showToast('✅ Tâche soumise avec succès !', 'success');
    if (elements.taskDescription) elements.taskDescription.value = '';
    await loadTasks();
  } catch (err) {
    await handleApiError(err, '❌ Erreur lors de la soumission');
  } finally {
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }
}

// =========================
// GESTION DU FORMULAIRE PROJET
// =========================
function showProjectForm() {
  if (elements.projectForm) elements.projectForm.style.display = 'block';
}
function hideProjectForm() {
  if (elements.projectForm) {
    elements.projectForm.style.display = 'none';
    if (elements.projectTitle) elements.projectTitle.value = '';
    if (elements.projectDesc) elements.projectDesc.value = '';
  }
}
async function handleSaveProject() {
  const title = elements.projectTitle?.value.trim();
  const type = elements.projectType?.value;
  const budgetModel = elements.budgetModel?.value;
  const description = elements.projectDesc?.value.trim();
  if (!title) {
    showToast('Veuillez entrer un titre', 'error');
    return;
  }
  if (title.length > 200) {
    showToast('Titre trop long (max 200 caractères)', 'error');
    return;
  }
  const saveBtn = elements.saveProjectBtn;
  if (saveBtn) {
    saveBtn.innerHTML = '⏳ Création...';
    saveBtn.disabled = true;
  }
  try {
    await createProject({ title, type, budgetModel, description });
    showToast('✅ Projet créé avec succès !', 'success');
    hideProjectForm();
    await loadProjects();
  } catch (err) {
    await handleApiError(err, '❌ Erreur lors de la création');
  } finally {
    if (saveBtn) {
      saveBtn.innerHTML = 'Enregistrer';
      saveBtn.disabled = false;
    }
  }
}

// =========================
// RAFRAÎCHISSEMENT PÉRIODIQUE
// =========================
function startAutoRefresh(intervalMs = 30000) {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(async () => {
    if (document.visibilityState === 'visible' && currentUser) {
      await Promise.all([loadUserData(), loadTasks(), loadProjects()]);
    }
  }, intervalMs);
}
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// =========================
// CONFIGURATION ÉCOUTEURS
// =========================
function setupEventListeners() {
  if (elements.submitTaskBtn) elements.submitTaskBtn.addEventListener('click', handleSubmitTask);
  if (elements.newProjectBtn) elements.newProjectBtn.addEventListener('click', showProjectForm);
  if (elements.saveProjectBtn) elements.saveProjectBtn.addEventListener('click', handleSaveProject);
  if (elements.cancelProjectBtn) elements.cancelProjectBtn.addEventListener('click', hideProjectForm);
  if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', () => logout());
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', async () => {
      showToast('🔄 Rafraîchissement...', 'info');
      await Promise.all([loadUserData(), loadTasks(), loadProjects()]);
      showToast('✅ Données mises à jour', 'success');
    });
  }
}

// =========================
// EXPOSER loadUserData DANS window POUR LES MODULES
// =========================
window.loadUserData = loadUserData;

// =========================
// INITIALISATION
// =========================
async function initDashboard() {
  const isAuth = await requireAuth('/login.html');
  if (!isAuth) return;
  currentUser = getUser();
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }
  cacheElements();
  await Promise.all([loadUserData(), loadTasks(), loadProjects()]);
  setupEventListeners();
  startAutoRefresh(30000);

  // Initialiser tous les modules frontend
  initQuiz(currentUser);
  initTimer(currentUser);
  initAgenda(currentUser);
  initAntGame(currentUser);

  onAuthChange((user) => {
    currentUser = user;
    if (!user) {
      stopAutoRefresh();
      window.location.href = '/login.html';
    }
  });
  console.log('✅ Dashboard initialisé avec tous les modules');
}

// =========================
// NETTOYAGE
// =========================
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});

// =========================
// DÉMARRAGE
// =========================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}