// =========================
// IMPORTS
// =========================
import guard from "./guard.js";
import auth from "./authSystem.js";
import API from "./api-core.js";
import URLS from "./url.js";
import UI from "./uisystem.js";
import Upload from "./upload.js";

// =========================
// INIT GUARD
// =========================
guard.initGuard();

// =========================
// DOM
// =========================
const container = document.getElementById("mediaContainer");
const input = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const logoutBtn = document.getElementById("logout");
const uploadZone = document.getElementById("uploadZone");

// =========================
// STATE
// =========================
let state = {
  loading: false,
  list: []
};

// =========================
// LOGOUT
// =========================
logoutBtn.onclick = () => auth.logout();

// =========================
// LOAD MEDIA
// =========================
async function loadMedia({ silent = false } = {}) {

  if (!silent) UI.skeleton(container, 6);

  try {

    const endpoint = URLS.build(
      URLS.query("/media", { mine: 1 })
    );

    const res = await API.get(endpoint);

    const list = res.media || res.data || [];

    state.list = list;

    render(list);

  } catch (err) {

    console.error(err);

    UI.error(container, "Erreur chargement médias");
  }
}

// =========================
// RENDER
// =========================
function render(list) {

  if (!list.length) {
    return UI.empty(container, "Aucun média");
  }

  container.innerHTML = "";

  list.forEach(m => {

    const el = document.createElement("div");
    el.className = "card fade-in";

    el.innerHTML = `
      ${m.type === "video"
        ? `<video src="${m.url}" controls></video>`
        : `<img src="${m.url}" loading="lazy" />`
      }

      <p>${m.title || "Sans titre"}</p>

      <div class="actions">
        <button class="btn delete">Supprimer</button>
      </div>
    `;

    // DELETE
    el.querySelector(".delete").onclick = async () => {

      const ok = await UI.confirm("Supprimer ce média ?");
      if (!ok) return;

      try {

        await API.post("/media/delete", { id: m.id });

        UI.toast("Supprimé");

        // 🔥 UPDATE LOCAL (no reload)
        state.list = state.list.filter(x => x.id !== m.id);
        render(state.list);

      } catch {
        UI.toast("Erreur suppression", "error");
      }
    };

    container.appendChild(el);
  });
}

// =========================
// UPLOAD PREVIEW
// =========================
function previewFile(file) {

  const reader = new FileReader();

  reader.onload = (e) => {

    const preview = document.createElement("div");
    preview.className = "card";

    preview.innerHTML = `
      <p>Preview</p>
      ${
        file.type.startsWith("video")
          ? `<video src="${e.target.result}" controls></video>`
          : `<img src="${e.target.result}" />`
      }
    `;

    container.prepend(preview);
  };

  reader.readAsDataURL(file);
}

// =========================
// UPLOAD HANDLER
// =========================
Upload.bindInput("#fileInput");

Upload.onStart = () => {
  UI.toast("Upload en cours...");
};

Upload.onSuccess = () => {
  UI.toast("Upload réussi");

  // 🔥 reload intelligent
  loadMedia({ silent: true });
};

Upload.onError = () => {
  UI.toast("Erreur upload", "error");
};

// =========================
// CLICK / DRAG
// =========================
uploadBtn.onclick = () => input.click();

uploadZone.onclick = () => input.click();

uploadZone.ondragover = (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = "var(--color-accent)";
};

uploadZone.ondragleave = () => {
  uploadZone.style.borderColor = "var(--color-primary)";
};

uploadZone.ondrop = (e) => {
  e.preventDefault();

  const file = e.dataTransfer.files[0];
  if (!file) return;

  input.files = e.dataTransfer.files;

  previewFile(file);
};

// =========================
// AUTO REFRESH (optionnel)
// =========================
setInterval(() => {
  loadMedia({ silent: true });
}, 60000); // 1 min

// =========================
// INIT
// =========================
loadMedia();