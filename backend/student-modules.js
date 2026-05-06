// =========================
// IMPORTS
// =========================
import { success, error } from "./utils/response.js";
import { getUserById } from "./db.js";
import { getBalance } from "./balanceService.js";
import { getUserTasks } from "./taskModule.js";

// =========================
// CONFIG NIVEAUX
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
// CALCUL NIVEAU
// =========================
function calculateLevel(points) {

  let current = LEVELS[0];
  let next = null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].points) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }

  let progress = 100;

  if (next) {
    const prevPoints = current.points;
    const nextPoints = next.points;

    progress = ((points - prevPoints) / (nextPoints - prevPoints)) * 100;
  }

  return {
    currentLevel: current.name,
    nextLevel: next ? next.name : null,
    progress: Math.min(100, Math.max(0, progress))
  };
}

// =========================
// STUDENT DASHBOARD
// =========================
export function getStudentDashboard(request) {

  const user = request.user;

  if (!user) return error("Non autorisé", 401);

  const dbUser = getUserById(user.id);
  if (!dbUser) return error("Utilisateur introuvable", 404);

  // balance
  const balance = getBalance(user.id);

  // tasks (on récupère directement via fonction interne)
  const tasksResponse = getUserTasks(request);
  const tasksData = JSON.parse(tasksResponse.body);
  const tasks = tasksData.data.tasks || [];

  // points BAR = somme des gains
  const totalPoints = tasks
    .filter(t => t.status === "approved")
    .reduce((sum, t) => {
      if (t.type === "timer") return sum + (t.value || 0);
      const map = {
        video: 50,
        quiz: 100,
        conference: 150,
        report: 200,
        exposure: 250,
        prospect: 120,
        campaign: 180
      };
      return sum + (map[t.type] || 0);
    }, 0);

  // niveau
  const levelData = calculateLevel(totalPoints);

  return success({
    user: {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role || "student"
    },
    balance,
    points: totalPoints,
    level: levelData.currentLevel,
    nextLevel: levelData.nextLevel,
    progress: levelData.progress,
    tasks
  });
}
