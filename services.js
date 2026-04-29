import api from "/js/apiCore.js";

// =========================
// DASHBOARD
// =========================
export async function getProfile() {
  return api.get("/user/profile");
}

export async function getProgress() {
  return api.get("/student/progress");
}

export async function getBalance() {
  return api.get("/balance");
}

export async function getDashboardData() {
  const [profile, progress, balance] = await Promise.all([
    getProfile(),
    getProgress(),
    getBalance()
  ]);

  return { profile, progress, balance };
}

// =========================
// TASKS / PROGRAM
// =========================
export async function getTasks() {
  return api.get("/student/tasks");
}

export async function submitTask(type, description, extra = {}) {
  return api.post("/task/submit", {
    type,
    description,
    ...extra
  });
}

// =========================
// BUSINESS / TRANSACTIONS
// =========================
export async function getTransactions() {
  return api.get("/transactions");
}

export async function addTransaction(amount, source = "manual") {
  return api.post("/transaction/add", {
    type: "gain",
    amount,
    source
  });
}

// =========================
// GALLERY
// =========================
export async function getGallery() {
  return api.get("/gallery");
}

export async function uploadGallery(url, description) {
  return api.post("/gallery/upload", {
    url,
    description
  });
}

export async function editGallery(id, description) {
  return api.post("/gallery/edit", {
    id,
    description
  });
}

export async function deleteGallery(id) {
  return api.post("/gallery/delete", {
    id
  });
}

// =========================
// EXPORT GROUPED (OPTIONAL)
// =========================
export default {
  // dashboard
  getProfile,
  getProgress,
  getBalance,
  getDashboardData,

  // tasks
  getTasks,
  submitTask,

  // business
  getTransactions,
  addTransaction,

  // gallery
  getGallery,
  uploadGallery,
  editGallery,
  deleteGallery
};