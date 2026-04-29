// =========================
// IMPORT CORE
// =========================
import { protectPage } from "../core/app.js";
import { getUser } from "../core/auth.js";

// =========================
// IMPORT SERVICES
// =========================
import {
  userService,
  balanceService,
  taskService,
  subscriptionService
} from "../services/index.js";

// =========================
// INIT DASHBOARD
// =========================
export async function initStudentDashboard() {

  await protectPage();

  const user = getUser();
  if (!user) return;

  try {

    // =========================
    // LOAD PROFILE
    // =========================
    const profile = await userService.getProfile();

    document.getElementById("userEmail").innerText = profile.user.email;
    document.getElementById("userRole").innerText = profile.user.role;

    // =========================
    // LOAD SUBSCRIPTION
    // =========================
    const sub = await subscriptionService.getStatus();

    document.getElementById("userPhase").innerText =
      sub.phase === "paid" ? "Abonnement actif" : "Essai";

    // =========================
    // LOAD BALANCE
    // =========================
    const balance = await balanceService.getBalance();

    document.getElementById("balance").innerText =
      balance.amount || 0;

    // =========================
    // LOAD TASKS
    // =========================
    const tasks = await taskService.getTasks();

    renderTasks(tasks);

  } catch (err) {
    console.error("Dashboard error:", err);
  }

  // =========================
  // EVENT SUBMIT TASK
  // =========================
  const btn = document.getElementById("submitTaskBtn");

  if (btn) {
    btn.addEventListener("click", submitTaskHandler);
  }
}

// =========================
// RENDER TASKS
// =========================
function renderTasks(tasks = []) {

  const container = document.getElementById("tasksList");

  if (!container) return;

  if (!tasks.length) {
    container.innerHTML = "<p>Aucune tâche.</p>";
    return;
  }

  container.innerHTML = tasks.map(t => `
    <div class="task-item">
      <strong>${t.type}</strong>
      <p>${t.description || ""}</p>
      <span>${formatStatus(t.status)}</span>
    </div>
  `).join("");
}

// =========================
// FORMAT STATUS
// =========================
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
async function submitTaskHandler() {

  const type = document.getElementById("taskType").value;
  const desc = document.getElementById("taskDescription").value.trim();

  if (!desc) {
    alert("Veuillez entrer une description");
    return;
  }

  try {

    await taskService.submitTask(null, type, desc);

    alert("Tâche envoyée");

    document.getElementById("taskDescription").value = "";

    // reload tasks
    const tasks = await taskService.getTasks();
    renderTasks(tasks);

  } catch (err) {
    alert("Erreur lors de l'envoi");
  }
}