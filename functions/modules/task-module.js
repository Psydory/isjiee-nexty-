// =========================
// IMPORTS
// =========================
import { success, error } from "./utils/response.js";
import { parseBody } from "./utils/request.js";
import { getUserById, addTransaction } from "./db.js";

// =========================
// CONFIG POINTS BAR
// =========================
const TASK_POINTS = {
  video: 50,
  quiz: 100,
  conference: 150,
  report: 200,
  exposure: 250,
  prospect: 120,
  campaign: 180,
  timer: 1 // par minute
};

// =========================
// TEMP STORAGE (à remplacer DB)
// =========================
let TASKS = [];

// =========================
// CREATE TASK
// =========================
export async function createTask(request) {

  const body = await parseBody(request);
  if (!body) return error("JSON invalide");

  const { userId, type, description, value } = body;

  if (!userId || !type) {
    return error("Champs requis");
  }

  const user = getUserById(userId);
  if (!user) return error("Utilisateur introuvable", 404);

  const task = {
    id: Date.now(),
    userId,
    type,
    description: description || "",
    status: "pending",
    value: value || 0,
    createdAt: new Date().toISOString()
  };

  // AUTO VALIDATION (quiz & timer)
  if (type === "quiz" || type === "timer") {
    task.status = "approved";

    const points = type === "timer"
      ? value || 0
      : TASK_POINTS[type] || 0;

    addTransaction(userId, points, "gain");
  }

  TASKS.push(task);

  return success({ task });
}

// =========================
// GET USER TASKS
// =========================
export function getUserTasks(request) {

  const user = request.user;

  if (!user) return error("Non autorisé", 401);

  const userTasks = TASKS.filter(t => t.userId === user.id);

  return success({ tasks: userTasks });
}

// =========================
// VALIDATE TASK (ADMIN)
// =========================
export async function validateTask(request) {

  const body = await parseBody(request);
  if (!body) return error("JSON invalide");

  const { taskId } = body;

  const task = TASKS.find(t => t.id == taskId);

  if (!task) return error("Tâche introuvable", 404);

  if (task.status !== "pending") {
    return error("Déjà traitée");
  }

  task.status = "approved";

  const points = TASK_POINTS[task.type] || 0;

  addTransaction(task.userId, points, "gain");

  return success({
    message: "Tâche validée",
    points
  });
}

// =========================
// REJECT TASK
// =========================
export async function rejectTask(request) {

  const body = await parseBody(request);
  if (!body) return error("JSON invalide");

  const { taskId } = body;

  const task = TASKS.find(t => t.id == taskId);

  if (!task) return error("Tâche introuvable", 404);

  task.status = "rejected";

  return success({
    message: "Tâche rejetée"
  });
}
