// =========================
// IMPORTS
// =========================
import API from "/js/api-core.js";
import UI from "/js/uisystem.js";

// =========================
// DOM
// =========================
const container = document.getElementById("gallery");

// =========================
// STATE
// =========================
let page = 1;
let loading = false;
let finished = false;

// =========================
// LOAD MEDIA
// =========================
async function loadPage() {

  if (loading || finished) return;

  loading = true;

  // Skeleton (UX)
  if (page === 1) {
    UI.skeleton(container, 8);
  }

  try {

    const res = await API.get(`/media?page=${page}&limit=12`);

    const list = res.media || [];

    // FIN
    if (!list.length) {
      finished = true;

      if (page === 1) {
        UI.empty(container, "Aucun contenu disponible");
      }

      return;
    }

    render(list);

    page++;

  } catch (err) {

    console.error(err);
    UI.error(container, "Erreur chargement");

  } finally {
    loading = false;
  }
}

// =========================
// RENDER
// =========================
function render(list) {

  list.forEach(m => {

    const item = document.createElement("div");
    item.className = "gallery-item fade-in";

    item.innerHTML = `
      ${
        m.type === "video"
          ? `<video src="${m.url}" muted loop></video>`
          : `<img src="${m.url}" loading="lazy" />`
      }

      <div class="gallery-overlay"></div>

      <div class="media-info">
        <p>${m.title || "Sans titre"}</p>
      </div>
    `;

    const video = item.querySelector("video");

    // =========================
    // HOVER (VIDEO)
    // =========================
    item.addEventListener("mouseenter", () => {
      if (video) video.play();
    });

    item.addEventListener("mouseleave", () => {
      if (video) video.pause();
    });

    // =========================
    // CLICK (FOCUS + TRACK)
    // =========================
    item.addEventListener("click", () => {

      localStorage.setItem("focusMedia", m.id);

      // track view (silencieux)
      API.media.view(m.id).catch(() => {});

      // reload page (focus mode possible)
      window.location.href = "/gallery.html";
    });

    container.appendChild(item);
  });
}

// =========================
// SCROLL INTELLIGENT
// =========================
function handleScroll() {

  const threshold = 300;

  const nearBottom =
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - threshold;

  if (nearBottom) {
    loadPage();
  }
}

window.addEventListener("scroll", handleScroll);

// =========================
// INIT
// =========================
function init() {

  if (!container) return;

  loadPage();

}

init();