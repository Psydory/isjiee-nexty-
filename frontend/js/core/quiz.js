// =========================
// frontend/js/modules/quiz.js
// QUIZ INTELLIGENT – VERSION PRODUCTION
// =========================

import { submitTask } from '/js/api.js';

// =========================
// CONFIGURATION
// =========================
const QUIZ_STORAGE_KEY = 'quiz_progress';
const QUIZ_COMPLETED_KEY = 'quiz_completed';

// Questions (peuvent être chargées depuis une API plus tard)
const QUIZ_QUESTIONS = [
  { text: "🐜 Pourquoi certaines personnes restent pauvres ?", type: "info", points: 0 },
  { text: "💰 Si tu gagnes 100$, que fais-tu ?", options: ["Dépenser", "Garder", "Investir"], correct: 2, points: 1, type: "choice" },
  { text: "💡 Actif = gagne | Passif = perd", type: "info", points: 0 },
  { text: "🪞 Tu dépenses sans réfléchir ?", options: ["Oui", "Non"], correct: 1, points: 1, type: "choice" },
  { text: "🐜 Ton comportement crée ton futur", type: "info", points: 0 },
  { text: "🎮 Investir = ?", options: ["Perte", "Croissance"], correct: 1, points: 1, type: "choice" },
  { text: "📊 Calcul...", type: "info", points: 0 }
];

let currentStep = 0;
let totalScore = 0;
let currentUser = null;
let pendingSubmission = false;
let onPointsAddedCallback = null;

// Éléments DOM
let container = null;
let resultDiv = null;
let startBtn = null;

// =========================
// NOTIFICATION (toast ou alert)
// =========================
function showMessage(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    alert(message);
  }
}

// =========================
// SAUVEGARDE / RESTAURATION DE LA PROGRESSION
// =========================
function saveProgress() {
  const state = { step: currentStep, score: totalScore };
  sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state));
}

function restoreProgress() {
  const saved = sessionStorage.getItem(QUIZ_STORAGE_KEY);
  if (saved) {
    try {
      const state = JSON.parse(saved);
      currentStep = state.step || 0;
      totalScore = state.score || 0;
    } catch(e) {}
  }
}

function clearProgress() {
  sessionStorage.removeItem(QUIZ_STORAGE_KEY);
}

// =========================
// FIN DU QUIZ – SOUMISSION DES POINTS
// =========================
async function finishQuiz() {
  if (!currentUser) return;
  if (pendingSubmission) return;
  if (localStorage.getItem(QUIZ_COMPLETED_KEY) === 'true') {
    showMessage('Vous avez déjà complété ce quiz.', 'info');
    return;
  }

  const maxScore = QUIZ_QUESTIONS.filter(q => q.type === 'choice').length;
  const percentage = (totalScore / maxScore) * 100;
  let level = "";
  if (percentage <= 33) level = "Débutant";
  else if (percentage <= 66) level = "Intermédiaire";
  else level = "Avancé";

  pendingSubmission = true;
  try {
    const result = await submitTask('quiz', `Score: ${totalScore}/${maxScore} - Niveau ${level}`, `score:${totalScore}`, totalScore);
    if (result.success) {
      localStorage.setItem(QUIZ_COMPLETED_KEY, 'true');
      showMessage(`✅ Quiz terminé ! Niveau ${level} – +${totalScore} points BAR.`, 'success');
      if (onPointsAddedCallback) onPointsAddedCallback();
      if (typeof window.loadUserData === 'function') window.loadUserData();
    } else {
      showMessage('❌ Erreur lors de l’enregistrement des points.', 'error');
    }
  } catch (err) {
    console.error('Quiz submission error:', err);
    showMessage('❌ Erreur réseau. Réessaie plus tard.', 'error');
  } finally {
    pendingSubmission = false;
  }
}

// =========================
// AFFICHAGE D’UNE QUESTION
// =========================
function renderCurrentQuestion() {
  if (!container) return;

  if (currentStep >= QUIZ_QUESTIONS.length) {
    // Quiz terminé
    container.innerHTML = `<p>🎉 Quiz terminé ! Bravo.</p>`;
    if (resultDiv) {
      const maxScore = QUIZ_QUESTIONS.filter(q => q.type === 'choice').length;
      resultDiv.innerHTML = `Score: ${totalScore} / ${maxScore}`;
    }
    finishQuiz();
    return;
  }

  const q = QUIZ_QUESTIONS[currentStep];
  let html = `<div class="quiz-question"><p>${q.text}</p>`;

  if (q.type === 'choice' && q.options) {
    html += '<div class="quiz-options" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">';
    q.options.forEach((opt, idx) => {
      html += `<button class="quiz-answer btn-outline" data-opt="${idx}">${opt}</button>`;
    });
    html += '</div>';
  } else {
    html += '<button id="quizNextBtn" class="btn-primary">Suivant</button>';
  }
  html += '</div>';

  container.innerHTML = html;

  if (q.type === 'choice') {
    document.querySelectorAll('.quiz-answer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const selected = parseInt(e.currentTarget.dataset.opt);
        if (selected === q.correct) {
          totalScore += q.points;
          showMessage('✅ Bonne réponse !', 'success');
        } else {
          showMessage(`❌ Mauvaise réponse. La bonne réponse était : ${q.options[q.correct]}`, 'error');
        }
        currentStep++;
        saveProgress();
        renderCurrentQuestion();
      });
    });
  } else {
    const nextBtn = document.getElementById('quizNextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentStep++;
        saveProgress();
        renderCurrentQuestion();
      });
    }
  }
}

// =========================
// RÉINITIALISATION COMPLÈTE DU QUIZ
// =========================
export function resetQuiz() {
  if (pendingSubmission) return;
  currentStep = 0;
  totalScore = 0;
  clearProgress();
  // Ne pas supprimer le flag de complétion pour éviter de regagner des points
  // Mais on peut permettre de rejouer sans attribution de points.
  // On supprime uniquement la progression, pas le flag.
  renderCurrentQuestion();
  if (startBtn) startBtn.disabled = false;
}

// =========================
// INITIALISATION
// =========================
export function initQuiz(user, onPointsAdded = null) {
  if (!user) {
    console.warn('Quiz: utilisateur non fourni');
    return;
  }
  currentUser = user;
  onPointsAddedCallback = onPointsAdded;

  container = document.getElementById('quizContainer');
  resultDiv = document.getElementById('quizResult');
  startBtn = document.getElementById('startQuizBtn');

  if (!container) {
    console.warn('Quiz: conteneur #quizContainer introuvable');
    return;
  }

  // Restaurer la progression si elle existe
  restoreProgress();

  // Démarrer l’affichage
  renderCurrentQuestion();

  // Activer le bouton de démarrage (s’il existe)
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (pendingSubmission) return;
      resetQuiz();
    });
  }
}

// =========================
// EXPORT PAR DÉFAUT
// =========================
export default { initQuiz, resetQuiz };