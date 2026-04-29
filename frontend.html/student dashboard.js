// =========================
// IMPORTS
// =========================
import { apiFetch } from "./apiReady.js";
import { getUser, isAuthenticated, logout } from "./auth.js";

// =========================
// INIT
// =========================
if (!isAuthenticated()) {
  window.location.href = "/login.html";
}

const user = getUser();

if (!user || user.role !== "student") {
  alert("Accès réservé aux étudiants");
  window.location.href = "/";
}

// =========================
// DOM
// =========================
const emailEl = document.getElementById("userEmail");
const roleEl = document.getElementById("userRole");
const levelEl = document.getElementById("userLevel");
const pointsEl = document.getElementById("points");
const balanceEl = document.getElementById("balance");
const progressFill = document.getElementById("progressFill");
const nextLevelInfo = document.getElementById("nextLevelInfo");
const tasksList = document.getElementById("tasksList");

// =========================
// LEVEL SYSTEM
// =========================
const LEVELS = [
  { name: "Green Star", points: 0 },
  { name: "Blue Star", points: 5000 },
  { name: "Gold Star", points: 10000 },
  { name: "Lead Star", points: 15000 },
  { name: "Mentor", points: 20000 },
  { name: "Crystal Mag", points: 25000 }
];

// =========================
// LOAD DASHBOARD DATA
// =========================
async function loadDashboard() {
  try {
    const [profile, balance, progress] = await Promise.all([
      apiFetch("/user/profile"),
      apiFetch("/balance"),
      apiFetch("/student/progress")
    ]);

    renderProfile(profile);
    renderBalance(balance);
    renderProgress(progress);
    renderTasks(progress.tasks || []);

  } catch (err) {
    console.error("Dashboard error:", err);
    alert("Erreur chargement dashboard");
  }
}

// =========================
// PROFILE
// =========================
function renderProfile(profile) {
  emailEl.innerText = profile.email;
  roleEl.innerText = profile.role;
}

// =========================
// BALANCE
// =========================
function renderBalance(data) {
  balanceEl.innerText = data.amount || 0;
}

// =========================
// PROGRESS
// =========================
function renderProgress(data) {
  const points = data.points || 0;

  pointsEl.innerText = points;

  const current = LEVELS.reduce((acc, lvl) => {
    return points >= lvl.points ? lvl : acc;
  }, LEVELS[0]);

  levelEl.innerText = current.name;

  const next = LEVELS.find(l => l.points > points);

  if (next) {
    const prevPoints = current.points;
    const percent =
      ((points - prevPoints) / (next.points - prevPoints)) * 100;

    progressFill.style.width = `${Math.min(100, percent)}%`;

    nextLevelInfo.innerText =
      `Prochain niveau : ${next.name} (${points}/${next.points})`;

  } else {
    progressFill.style.width = "100%";
    nextLevelInfo.innerText = "Niveau maximum atteint";
  }
}

// =========================
// TASKS
// =========================
function renderTasks(tasks) {
  if (!tasks.length) {
    tasksList.innerHTML = "<p>Aucune tâche</p>";
    return;
  }

  tasksList.innerHTML = tasks.map(t => `
    <div class="task-item">
      <strong>${t.type}</strong>
      <p>${t.description || ""}</p>
      <span class="status ${t.status}">
        ${formatStatus(t.status)}
      </span>
    </div>
  `).join("");
}

function formatStatus(status) {
  switch (status) {
    case "approved": return "✅ Validé";
    case "pending": return "⏳ En attente";
    case "rejected": return "❌ Rejeté";
    default: return status;
  }
}

// =========================
// SUBMIT TASK
// =========================
document.getElementById("submitTaskBtn")?.addEventListener("click", async () => {

  const type = document.getElementById("taskType").value;
  const description = document.getElementById("taskDescription").value;

  if (!description) {
    alert("Description requise");
    return;
  }

  try {
    await apiFetch("/task/submit", {
      method: "POST",
      body: JSON.stringify({
        type,
        description
      })
    });

    alert("Tâche envoyée");
    loadDashboard();

  } catch (err) {
    alert("Erreur soumission");
  }
});

// =========================
// LOGOUT
// =========================
document.getElementById("logoutBtn")?.addEventListener("click", logout);

// =========================
// START
// =========================
loadDashboard();