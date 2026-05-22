// =========================
// assets/js/modules/agenda.js
// AGENDA ACADÉMIQUE - PARCOURS 8 SEMAINES (VERSION CORRIGÉE)
// =========================

import { submitTask } from '/assets/js/api.js';

// =========================
// CONFIGURATION
// =========================
const WEEKS = [
  { number: 1, title: "Semaine 1 - Introduction", points: 5 },
  { number: 2, title: "Semaine 2 - Fondamentaux", points: 5 },
  { number: 3, title: "Semaine 3 - Stratégie", points: 5 },
  { number: 4, title: "Semaine 4 - Marketing", points: 5 },
  { number: 5, title: "Semaine 5 - Finance", points: 5 },
  { number: 6, title: "Semaine 6 - Lancement", points: 5 },
  { number: 7, title: "Semaine 7 - Croissance", points: 5 },
  { number: 8, title: "Semaine 8 - Certification", points: 10 }
];

let currentUser = null;
let containerElement = null;
let messageElement = null;
let pendingValidation = null;        // Empêche double soumission

// Stockage local de la progression (fallback)
let progress = {};

// =========================
// CHARGEMENT DE LA PROGRESSION
// =========================
function loadProgress() {
  const saved = localStorage.getItem('agenda_progress');
  if (saved) {
    try {
      progress = JSON.parse(saved);
    } catch(e) {}
  }
  // Initialiser les semaines non définies
  WEEKS.forEach(week => {
    if (progress[week.number] === undefined) {
      progress[week.number] = 'locked'; // locked, unlocked, completed
    }
  });
  // Débloquer la semaine 1 par défaut
  if (progress[1] === 'locked') progress[1] = 'unlocked';
  saveProgress();
}

function saveProgress() {
  localStorage.setItem('agenda_progress', JSON.stringify(progress));
}

// =========================
// DÉBLOQUER UNE SEMAINE (appelé après validation de la précédente)
// =========================
function unlockWeek(weekNumber) {
  if (weekNumber <= WEEKS.length && progress[weekNumber] === 'locked') {
    progress[weekNumber] = 'unlocked';
    saveProgress();
    renderAgenda();
    if (messageElement) messageElement.textContent = `🎉 Semaine ${weekNumber} débloquée !`;
  }
}

// =========================
// VALIDER UNE SEMAINE (avec vérifications)
// =========================
async function validateWeek(weekNumber) {
  // Éviter les doubles soumissions
  if (pendingValidation === weekNumber) return;
  if (!currentUser) {
    if (messageElement) messageElement.textContent = '❌ Utilisateur non authentifié.';
    return;
  }
  if (progress[weekNumber] !== 'unlocked') {
    if (messageElement) messageElement.textContent = `❌ La semaine ${weekNumber} n'est pas encore débloquée.`;
    return;
  }
  if (progress[weekNumber] === 'completed') {
    if (messageElement) messageElement.textContent = `✅ Semaine ${weekNumber} déjà validée.`;
    return;
  }

  // Vérifier que la semaine précédente est bien complétée (sauf pour la semaine 1)
  if (weekNumber > 1 && progress[weekNumber-1] !== 'completed') {
    if (messageElement) messageElement.textContent = `❌ Vous devez d'abord valider la semaine ${weekNumber-1}.`;
    return;
  }

  pendingValidation = weekNumber;
  const week = WEEKS.find(w => w.number === weekNumber);
  const points = week.points;

  try {
    const result = await submitTask(
      'agenda',
      `Validation semaine ${weekNumber} : ${week.title}`,
      `week:${weekNumber}`,
      points
    );
    if (result.success) {
      progress[weekNumber] = 'completed';
      saveProgress();
      // Débloquer la semaine suivante
      if (weekNumber < WEEKS.length) {
        unlockWeek(weekNumber + 1);
      }
      renderAgenda();
      if (messageElement) messageElement.innerHTML = `✅ Semaine ${weekNumber} validée ! +${points} points BAR.`;
      if (typeof window.loadUserData === 'function') window.loadUserData();
    } else {
      if (messageElement) messageElement.textContent = '❌ Erreur lors de la validation.';
    }
  } catch (err) {
    console.error('Agenda validation error:', err);
    if (messageElement) messageElement.textContent = '❌ Erreur réseau.';
  } finally {
    pendingValidation = null;
  }
}

// =========================
// AFFICHAGE DE L'AGENDA
// =========================
function renderAgenda() {
  if (!containerElement) return;
  let html = '<div class="agenda-grid" style="display:flex; flex-direction:column; gap:0.8rem;">';
  WEEKS.forEach(week => {
    const status = progress[week.number];
    let statusText = '';
    let statusClass = '';
    let disabled = true;
    if (status === 'locked') {
      statusText = '🔒 Verrouillé';
      statusClass = 'locked';
      disabled = true;
    } else if (status === 'unlocked') {
      statusText = '🔓 Débloqué';
      statusClass = 'unlocked';
      disabled = false;
    } else if (status === 'completed') {
      statusText = '✅ Validé';
      statusClass = 'completed';
      disabled = true;
    }
    html += `
      <div class="agenda-week ${statusClass}" style="background:#0f172a; border-radius:0.75rem; padding:0.75rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
        <div style="font-weight:bold;">Semaine ${week.number}</div>
        <div style="flex:1; margin-left:0.5rem;">${week.title}</div>
        <div style="font-size:0.8rem;">+${week.points} pts</div>
        <div style="font-size:0.75rem;">${statusText}</div>
        ${!disabled ? `<button class="validate-week-btn btn-small" data-week="${week.number}" style="background:#3b82f6; border:none; padding:0.3rem 0.8rem; border-radius:1rem; cursor:pointer;">Valider</button>` : ''}
      </div>
    `;
  });
  html += '</div>';
  containerElement.innerHTML = html;

  // Attacher les événements
  document.querySelectorAll('.validate-week-btn').forEach(btn => {
    btn.removeEventListener('click', handleValidateClick);
    btn.addEventListener('click', handleValidateClick);
  });
}

function handleValidateClick(e) {
  const week = parseInt(e.currentTarget.dataset.week);
  validateWeek(week);
}

// =========================
// INITIALISATION
// =========================
export function initAgenda(user) {
  if (!user) {
    console.warn('Agenda: utilisateur non fourni');
    return;
  }
  currentUser = user;
  containerElement = document.getElementById('academicAgenda');
  messageElement = document.getElementById('agendaMessage');
  if (!containerElement) {
    console.warn('Agenda: élément #academicAgenda introuvable');
    return;
  }
  loadProgress();
  renderAgenda();
}

// =========================
// RÉINITIALISATION COMPLÈTE (admin / debug)
// =========================
export function resetAgenda() {
  progress = {};
  WEEKS.forEach(week => {
    progress[week.number] = 'locked';
  });
  progress[1] = 'unlocked';
  saveProgress();
  renderAgenda();
  if (messageElement) messageElement.textContent = '🔄 Agenda réinitialisé.';
}

// =========================
// EXPORT
// =========================
export default { initAgenda, resetAgenda };