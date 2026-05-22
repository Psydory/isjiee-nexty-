// =========================
// assets/js/modules/ant-game.js
// DÉFI FOURMI - ÉDUCATION FINANCIÈRE (VERSION CORRIGÉE)
// =========================

import { submitTask } from '/assets/js/api.js';

// =========================
// CONFIGURATION
// =========================
let currentUser = null;
let antTextElement = null;
let choicesElement = null;
let progressElement = null;

let step = 0;
let score = 0;
let subStep = 0;
let gameCompleted = false;

// Verrous anti-double soumission
let pendingPoints = false;
const POINTS_CLAIMED_KEY = 'ant_game_points_claimed';
const BONUS_CLAIMED_KEY = 'ant_bonus_claimed';

// =========================
// NETTOYAGE ET RÉINITIALISATION
// =========================
function resetGame() {
  step = 0;
  score = 0;
  subStep = 0;
  gameCompleted = false;
  if (antTextElement) antTextElement.innerText = "🐜 Prêt à relever le défi ?";
  if (choicesElement) choicesElement.innerHTML = "";
  if (progressElement) progressElement.innerText = "";
  next(); // Démarrer
}

// =========================
// CŒUR DU JEU
// =========================
function next() {
  if (gameCompleted) return;
  step++;
  if (progressElement) progressElement.innerText = `Étape ${step}/8`;

  switch(step) {
    case 1:
      antTextElement.innerText = "🐜 Pourquoi certaines personnes restent pauvres ?";
      choicesElement.innerHTML = '<button class="game-btn" data-action="next">Continuer</button>';
      break;
    case 2:
      antTextElement.innerText = "💰 Si tu gagnes 100$, que fais-tu ?";
      choicesElement.innerHTML = `
        <button class="game-btn" data-answer="0">Dépenser</button>
        <button class="game-btn" data-answer="1">Garder</button>
        <button class="game-btn" data-answer="2">Investir</button>
      `;
      break;
    case 3:
      antTextElement.innerText = "💡 Actif = gagne | Passif = perd";
      choicesElement.innerHTML = '<button class="game-btn" data-action="next">OK</button>';
      break;
    case 4:
      antTextElement.innerText = "🪞 Tu dépenses sans réfléchir ?";
      choicesElement.innerHTML = `
        <button class="game-btn" data-answer="0">Oui</button>
        <button class="game-btn" data-answer="1">Non</button>
      `;
      break;
    case 5:
      antTextElement.innerText = "🐜 Ton comportement crée ton futur";
      choicesElement.innerHTML = '<button class="game-btn" data-action="next">Suite</button>';
      break;
    case 6:
      antTextElement.innerText = "🎮 Investir = ?";
      choicesElement.innerHTML = `
        <button class="game-btn" data-answer="0">Perte</button>
        <button class="game-btn" data-answer="1">Croissance</button>
      `;
      break;
    case 7:
      antTextElement.innerText = "📊 Calcul...";
      choicesElement.innerHTML = '<button class="game-btn" data-action="next">Voir résultat</button>';
      break;
    case 8:
      // Fin du quiz principal
      let level = score <= 1 ? "Débutant" : (score === 2 ? "Intermédiaire" : "Avancé");
      antTextElement.innerText = `🐜 Niveau : ${level}`;
      localStorage.setItem("ant_level", level);
      choicesElement.innerHTML = '<button class="game-btn" data-action="focusMoney">Focus Argent</button>';
      progressElement.innerText = "Quiz terminé ! Optionnel : Focus Argent";
      gameCompleted = true;

      // Soumettre les points UNE SEULE FOIS
      if (currentUser && !pendingPoints && !localStorage.getItem(POINTS_CLAIMED_KEY)) {
        pendingPoints = true;
        submitTask('ant_challenge', `Défi Fourmi terminé - Niveau ${level}`, `score:${score}`, 10)
          .then(result => {
            if (result.success) {
              localStorage.setItem(POINTS_CLAIMED_KEY, 'true');
              if (typeof window.loadUserData === 'function') window.loadUserData();
            }
          })
          .catch(err => console.error("Erreur soumission défi:", err))
          .finally(() => { pendingPoints = false; });
      }
      break;
    default:
      antTextElement.innerText = "🐜 Défi terminé !";
      choicesElement.innerHTML = "";
  }
  attachEvents();
}

// =========================
// SOUS-ÉTAPES "FOCUS ARGENT"
// =========================
function subNext() {
  subStep++;
  if (progressElement) progressElement.innerText = "Argent " + subStep + "/5";
  switch(subStep) {
    case 1:
      antTextElement.innerText = "💰 Que fais-tu avec ton argent ?";
      choicesElement.innerHTML = '<button class="game-btn" data-action="subNext">Suivant</button>';
      break;
    case 2:
      antTextElement.innerText = "💡 Dépenser vs Investir";
      choicesElement.innerHTML = '<button class="game-btn" data-action="subNext">OK</button>';
      break;
    case 3:
      antTextElement.innerText = "🪞 Note ta gestion sur 10";
      choicesElement.innerHTML = '<button class="game-btn" data-action="subNext">Continuer</button>';
      break;
    case 4:
      antTextElement.innerText = "🎯 Note 3 dépenses inutiles";
      choicesElement.innerHTML = '<button class="game-btn" data-action="subNext">Fait</button>';
      break;
    case 5:
      antTextElement.innerText = "🏆 Bravo ! +5 points bonus";
      choicesElement.innerHTML = '<button class="game-btn" data-action="resetGame">Retour</button>';
      // Bonus UNE SEULE FOIS
      if (currentUser && !pendingPoints && !localStorage.getItem(BONUS_CLAIMED_KEY)) {
        pendingPoints = true;
        submitTask('ant_bonus', 'Focus Argent terminé', 'bonus', 5)
          .then(result => {
            if (result.success) {
              localStorage.setItem(BONUS_CLAIMED_KEY, 'true');
              if (typeof window.loadUserData === 'function') window.loadUserData();
            }
          })
          .catch(err => console.error("Erreur bonus:", err))
          .finally(() => { pendingPoints = false; });
      }
      break;
    default:
      antTextElement.innerText = "🐜 Retour au défi principal";
      choicesElement.innerHTML = '<button class="game-btn" data-action="resetGame">OK</button>';
  }
  attachEvents();
}

// =========================
// GESTION DES RÉPONSES
// =========================
function answer(value) {
  score += value;
  next();
}

// =========================
// ATTACHEMENT DES ÉVÉNEMENTS
// =========================
function attachEvents() {
  document.querySelectorAll('.game-btn').forEach(btn => {
    btn.removeEventListener('click', handleClick);
    btn.addEventListener('click', handleClick);
  });
}

function handleClick(e) {
  // Empêcher les clics multiples pendant le traitement
  if (pendingPoints) return;

  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const answerVal = btn.dataset.answer;

  if (action === 'next') {
    next();
  } else if (action === 'subNext') {
    subNext();
  } else if (action === 'focusMoney') {
    subStep = 0;
    subNext();
  } else if (action === 'resetGame') {
    resetGame();
  } else if (answerVal !== undefined) {
    answer(parseInt(answerVal));
  }
}

// =========================
// INITIALISATION
// =========================
export function initAntGame(user) {
  if (!user) {
    console.warn('AntGame: utilisateur non fourni');
    return;
  }
  currentUser = user;
  antTextElement = document.getElementById('antText');
  choicesElement = document.getElementById('choices');
  progressElement = document.getElementById('progress');

  if (!antTextElement || !choicesElement) {
    console.warn('AntGame: éléments DOM manquants (#antText, #choices)');
    return;
  }

  resetGame();
}

// =========================
// EXPORT
// =========================
export default { initAntGame, resetGame };