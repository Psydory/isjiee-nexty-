// =========================
// IMPORTS
// =========================
import { success, error } from "./utils/response.js";
import { parseBody } from "./utils/request.js";

// =========================
// TEMP STORAGE (à remplacer DB)
// =========================
let PROJECTS = [];

// =========================
// CREATE PROJECT
// =========================
export async function createProject(request) {

  const user = request.user;

  if (!user) return error("Non autorisé", 401);

  const body = await parseBody(request);
  if (!body) return error("JSON invalide");

  const { title, type, budgetModel, description } = body;

  if (!title || !type) {
    return error("Champs requis");
  }

  const project = {
    id: Date.now(),
    userId: user.id,
    title,
    type, // mini | muni | grand
    budgetModel, // bootstrap | investisseur...
    description: description || "",
    status: "active",
    progress: 0,
    createdAt: new Date().toISOString()
  };

  PROJECTS.push(project);

  return success({ project });
}

// =========================
// GET USER PROJECTS
// =========================
export function getProjects(request) {

  const user = request.user;

  if (!user) return error("Non autorisé", 401);

  const userProjects = PROJECTS.filter(p => p.userId === user.id);

  return success({ projects: userProjects });
}

// =========================
// UPDATE PROJECT PROGRESS
// =========================
export async function updateProject(request) {

  const user = request.user;

  if (!user) return error("Non autorisé", 401);

  const body = await parseBody(request);
  if (!body) return error("JSON invalide");

  const { projectId, progress, status } = body;

  const project = PROJECTS.find(p => p.id == projectId);

  if (!project) return error("Projet introuvable", 404);

  if (project.userId !== user.id) {
    return error("Accès refusé", 403);
  }

  if (progress !== undefined) {
    project.progress = Math.max(0, Math.min(100, progress));
  }

  if (status) {
    project.status = status; // active | completed | paused
  }

  return success({ project });
}

// =========================
// DELETE PROJECT
// =========================
export async function deleteProject(request) {

  const user = request.user;

  if (!user) return error("Non autorisé", 401);

  const body = await parseBody(request);
  if (!body) return error("JSON invalide");

  const { projectId } = body;

  const index = PROJECTS.findIndex(p => p.id == projectId);

  if (index === -1) return error("Projet introuvable", 404);

  if (PROJECTS[index].userId !== user.id) {
    return error("Accès refusé", 403);
  }

  PROJECTS.splice(index, 1);

  return success({ message: "Projet supprimé" });
}
