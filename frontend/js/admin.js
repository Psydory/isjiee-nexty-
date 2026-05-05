// =========================
// IMPORTS
// =========================
import API from "./api-core.js";
import URLS from "./url.js";
import UI from "./uisystem.js";
import auth from "./authSystem.js";
import guard from "./guard.js";

// =========================
// INIT GUARD (SECURITE)
// =========================
guard.initGuard();

// =========================
// DOM
// =========================
const mediaContainer = document.getElementById("media");
const usersContainer = document.getElementById("users");
const statsContainer = document.getElementById("stats");
const logoutBtn = document.getElementById("logout");

// =========================
// LOGOUT
// =========================
if (logoutBtn) {
  logoutBtn.onclick = () => auth.logout();
}

// =========================
// LOAD STATS
// =========================
async function loadStats() {
  try {
    const data = await API.get("/admin/stats");

    statsContainer.innerHTML = `
      <p>📦 Media: ${data.media}</p>
      <p>👤 Users: ${data.users}</p>
    `;
  } catch {
    UI.error(statsContainer, "Erreur stats");
  }
}

// =========================
// LOAD MEDIA
// =========================
async function loadMedia() {

  UI.skeleton(mediaContainer, 4);

  try {
    const data = await API.get("/admin/media");
    renderMedia(data.media || []);
  } catch {
    UI.error(mediaContainer, "Accès refusé");
  }
}

function renderMedia(list) {

  if (!list.length) {
    return UI.empty(mediaContainer, "Aucun média");
  }

  mediaContainer.innerHTML = "";

  list.forEach(m => {

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      ${m.type === "video"
        ? `<video src="${m.url}" controls></video>`
        : `<img src="${m.url}" loading="lazy"/>`
      }

      <p><strong>${m.title || "Sans titre"}</strong></p>
      <p>Status: ${m.status}</p>
      <p>Visibility: ${m.visibility}</p>

      <div class="actions">
        <button class="btn approve">Approve</button>
        <button class="btn reject">Reject</button>
        <button class="btn feature">${m.featured ? "Unfeature" : "Feature"}</button>
        <button class="btn delete">Delete</button>
      </div>
    `;

    // APPROVE
    card.querySelector(".approve").onclick = async () => {
      await API.post("/admin/media/moderate", {
        id: m.id,
        status: "approved"
      });
      UI.toast("Approuvé");
      loadMedia();
    };

    // REJECT
    card.querySelector(".reject").onclick = async () => {
      await API.post("/admin/media/moderate", {
        id: m.id,
        status: "rejected"
      });
      UI.toast("Rejeté");
      loadMedia();
    };

    // FEATURE
    card.querySelector(".feature").onclick = async () => {
      await API.post("/admin/media/feature", {
        id: m.id,
        featured: m.featured ? 0 : 1
      });
      UI.toast("Mis à jour");
      loadMedia();
    };

    // DELETE
    card.querySelector(".delete").onclick = async () => {

      const ok = await UI.confirm("Supprimer ce média ?");
      if (!ok) return;

      await API.post("/media/delete", { id: m.id });

      UI.toast("Supprimé");
      loadMedia();
    };

    mediaContainer.appendChild(card);
  });
}

// =========================
// LOAD USERS
// =========================
async function loadUsers() {

  UI.skeleton(usersContainer, 4);

  try {
    const data = await API.get("/admin/users");
    renderUsers(data.users || []);
  } catch {
    UI.error(usersContainer, "Erreur utilisateurs");
  }
}

function renderUsers(list) {

  if (!list.length) {
    return UI.empty(usersContainer, "Aucun utilisateur");
  }

  usersContainer.innerHTML = "";

  list.forEach(u => {

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <p>ID: ${u.id}</p>
      <p>Role: ${u.role}</p>
      <p>Banned: ${u.banned ? "Oui" : "Non"}</p>

      <button class="btn ban">
        ${u.banned ? "Unban" : "Ban"}
      </button>
    `;

    card.querySelector(".ban").onclick = async () => {

      await API.post("/admin/users/ban", {
        id: u.id,
        banned: u.banned ? 0 : 1
      });

      UI.toast("Utilisateur mis à jour");
      loadUsers();
    };

    usersContainer.appendChild(card);
  });
}

// =========================
// INIT
// =========================
async function init() {

  // 🔐 vérifie utilisateur
  const user = auth.getUser();

  if (!user || user.role !== "admin") {
    UI.toast("Accès refusé", "error");
    return URLS.goHome();
  }

  loadStats();
  loadMedia();
  loadUsers();
}

init();