// =========================
// assets/js/modules/timer.js
// CHRONOMÈTRE D'ACTIVITÉ AVEC CONVERSION EN POINTS BAR
// =========================

import { submitTask } from '/assets/js/api.js';

// =========================
// ÉTAT INTERNE
// =========================
let timerInterval = null;
let elapsedSeconds = 0;
let isRunning = false;
let currentUser = null;
let displayElement = null;
let messageElement = null;

// =========================
// FORMATAGE HH:MM:SS
// =========================
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =========================
// MISE À JOUR DE L'AFFICHAGE
// =========================
function updateDisplay() {
  if (displayElement) {
    displayElement.textContent = formatTime(elapsedSeconds);
  }
}

// =========================
// DÉMARRER LE CHRONOMÈTRE
// =========================
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateDisplay();
  }, 1000);
  if (messageElement) messageElement.textContent = '⏱️ Chronomètre en cours...';
}

// =========================
// METTRE EN PAUSE
// =========================
function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (messageElement) messageElement.textContent = '⏸️ Chronomètre en pause.';
}

// =========================
// RÉINITIALISER
// =========================
function resetTimer() {
  const wasRunning = isRunning;
  if (wasRunning) pauseTimer();
  elapsedSeconds = 0;
  updateDisplay();
  if (messageElement) messageElement.textContent = '🔄 Chronomètre réinitialisé.';
  if (wasRunning) startTimer();
}

// =========================
// CONVERTIR LE TEMPS ÉCOULÉ EN POINTS ET SOUMETTRE
// =========================
async function convertToPoints() {
  if (!currentUser) {
    if (messageElement) messageElement.textContent = '❌ Utilisateur non authentifié.';
    return;
  }
  if (elapsedSeconds < 60) {
    if (messageElement) messageElement.textContent = '⏳ Attendez au moins 1 minute pour convertir.';
    return;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const points = minutes; // 1 point par minute

  const convertBtn = document.getElementById('convertTimer');
  if (convertBtn) {
    convertBtn.disabled = true;
    convertBtn.textContent = '⏳ Envoi...';
  }

  try {
    const result = await submitTask(
      'timer',
      `Temps étudié : ${minutes} minute(s)`,
      `minutes:${minutes}`,
      points
    );
    if (result.success) {
      if (messageElement) messageElement.innerHTML = `✅ +${points} points BAR ajoutés pour ${minutes} minute(s) !`;
      resetTimer(); // Réinitialiser après conversion réussie
      if (typeof window.loadUserData === 'function') window.loadUserData();
    } else {
      if (messageElement) messageElement.textContent = '❌ Erreur lors de la soumission.';
    }
  } catch (err) {
    console.error('Timer conversion error:', err);
    if (messageElement) messageElement.textContent = '❌ Erreur réseau.';
  } finally {
    if (convertBtn) {
      convertBtn.disabled = false;
      convertBtn.textContent = '✨ Convertir en points';
    }
  }
}

// =========================
// ATTACHER LES ÉCOUTEURS AUX BOUTONS
// =========================
function bindEvents() {
  const startBtn = document.getElementById('startTimer');
  const pauseBtn = document.getElementById('pauseTimer');
  const resetBtn = document.getElementById('resetTimer');
  const convertBtn = document.getElementById('convertTimer');

  if (startBtn) startBtn.addEventListener('click', startTimer);
  if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
  if (resetBtn) resetBtn.addEventListener('click', resetTimer);
  if (convertBtn) convertBtn.addEventListener('click', convertToPoints);
}

// =========================
// INITIALISATION
// =========================
export function initTimer(user) {
  if (!user) {
    console.warn('Timer: utilisateur non fourni');
    return;
  }
  currentUser = user;
  displayElement = document.getElementById('timerDisplay');
  messageElement = document.getElementById('timerMessage');
  if (!displayElement) {
    console.warn('Timer: élément #timerDisplay introuvable');
    return;
  }
  updateDisplay();
  bindEvents();

  // Restaurer l'état depuis sessionStorage
  try {
    const saved = sessionStorage.getItem('timerState');
    if (saved) {
      const state = JSON.parse(saved);
      elapsedSeconds = state.elapsedSeconds || 0;
      updateDisplay();
      if (state.isRunning) startTimer();
    }
  } catch (e) {}
}

// =========================
// SAUVEGARDE DE L'ÉTAT
// =========================
function saveState() {
  if (isRunning || elapsedSeconds > 0) {
    sessionStorage.setItem('timerState', JSON.stringify({ elapsedSeconds, isRunning }));
  }
}
window.addEventListener('beforeunload', () => {
  if (isRunning) saveState();
});

// =========================
// EXPORT PAR DÉFAUT
// =========================
export default { initTimer };