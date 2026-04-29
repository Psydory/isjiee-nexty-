// =========================
// IMPORTS
// =========================
import {
  createTask,
  getTasksByUser,
  updateTaskStatus,
  addPointsToUser
} from "../db.js";

import { success, error } from "../utils.js";

// =========================
// GET TASKS
// =========================
export async function getTasksController(request) {

  try {

    const user = request.user;

    const tasks = await getTasksByUser(user.id);

    return success({
      tasks: tasks || []
    });

  } catch (err) {
    console.error(err);
    return error("Erreur récupération tâches", 500);
  }
}

// =========================
// SUBMIT TASK
// =========================
export async function submitTaskController(request) {

  try {

    const user = request.user;
    const body = request.body;

    const { type, description, meta } = body;

    if (!type || !description) {
      return error("Type et description requis");
    }

    // =========================
    // CREATE TASK
    // =========================
    const task = await createTask({
      userId: user.id,
      type,
      description,
      meta: meta || "",
      status: "pending",
      createdAt: Date.now()
    });

    return success({
      status: "submitted",
      task
    });

  } catch (err) {
    console.error(err);
    return error("Erreur soumission tâche", 500);
  }
}

// =========================
// VALIDATE TASK (ADMIN)
// =========================
export async function validateTaskController(request) {

  try {

    const body = request.body;

    const { taskId, status } = body;

    if (!taskId || !status) {
      return error("Paramètres requis");
    }

    const validStatus = ["approved", "rejected"];

    if (!validStatus.includes(status)) {
      return error("Statut invalide");
    }

    // =========================
    // UPDATE TASK
    // =========================
    const task = await updateTaskStatus(taskId, status);

    if (!task) {
      return error("Tâche introuvable");
    }

    // =========================
    // ADD POINTS SI APPROUVÉ
    // =========================
    if (status === "approved") {

      const pointsMap = {
        video: 50,
        quiz: 100,
        conference: 150,
        report: 200,
        exposure: 150,
        prospect: 120,
        campaign: 180,
        timer: 1
      };

      const points = pointsMap[task.type] || 50;

      await addPointsToUser(task.userId, points);
    }

    return success({
      status,
      taskId
    });

  } catch (err) {
    console.error(err);
    return error("Erreur validation tâche", 500);
  }
}