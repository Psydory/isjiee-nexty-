// =========================
// IMPORT DB
// =========================
import {
  getUserById,
  getStudentProgress,
  createStudentProgress,
  addTask,
  getTasksByUser,
  updateUserPoints
} from "../db.js";

// =========================
// GET STUDENT PROGRESS
// =========================
export async function getProgressController(request, env) {

  const user = request.user;

  let progress = await getStudentProgress(user.id);

  // Création automatique si inexistant
  if (!progress) {
    progress = await createStudentProgress(user.id);
  }

  const tasks = await getTasksByUser(user.id);

  return new Response(JSON.stringify({
    points: progress.points || 0,
    level: progress.level || "Green Star",
    tasks
  }), { status: 200 });
}

// =========================
// SUBMIT TASK
// =========================
export async function submitTaskController(request, env) {

  const user = request.user;

  let body;

  try {
    body = await request.json();
  } catch {
    return new Response("JSON invalide", { status: 400 });
  }

  const { type, description } = body;

  if (!type) {
    return new Response("Type requis", { status: 400 });
  }

  // Création tâche
  const task = await addTask({
    userId: user.id,
    type,
    description,
    status: "pending",
    createdAt: Date.now()
  });

  return new Response(JSON.stringify({
    success: true,
    task
  }), { status: 201 });
}

// =========================
// VALIDATE TASK (ADMIN)
// =========================
export async function validateTaskController(request, env) {

  const user = request.user;

  if (user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return new Response("JSON invalide", { status: 400 });
  }

  const { taskId, status } = body;

  if (!taskId || !status) {
    return new Response("Paramètres manquants", { status: 400 });
  }

  // Points par type
  const POINTS = {
    video: 50,
    quiz: 100,
    conference: 150,
    report: 200,
    exposure: 120,
    prospect: 80,
    campaign: 150,
    timer: 1
  };

  const task = await env.DB.prepare(`
    SELECT * FROM tasks WHERE id = ?
  `).bind(taskId).first();

  if (!task) {
    return new Response("Tâche introuvable", { status: 404 });
  }

  // Update statut
  await env.DB.prepare(`
    UPDATE tasks SET status = ? WHERE id = ?
  `).bind(status, taskId).run();

  // Si validé → ajouter points
  if (status === "approved") {

    const points = POINTS[task.type] || 10;

    await updateUserPoints(task.userId, points);
  }

  return new Response(JSON.stringify({
    success: true
  }), { status: 200 });
}

// =========================
// GET TASKS (ADMIN)
// =========================
export async function getAllTasksController(request, env) {

  const user = request.user;

  if (user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const tasks = await env.DB.prepare(`
    SELECT * FROM tasks ORDER BY createdAt DESC
  `).all();

  return new Response(JSON.stringify(tasks.results), {
    status: 200
  });
}