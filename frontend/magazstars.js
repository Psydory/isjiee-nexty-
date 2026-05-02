import API from "/js/api-core.js";

const slider = document.getElementById("mediaSlider");

// =========================
// LOAD TRENDING
// =========================
async function loadTrending() {

  try {

    const res = await API.get("/media/trending");
    const list = res.media || [];

    if (!list.length) {
      slider.innerHTML = "<p class='ui-empty'>Aucun contenu</p>";
      return;
    }

    slider.innerHTML = list.map(m => `
      <div class="media-card premium-card" data-id="${m.id}">
        ${
          m.type === "video"
          ? `<video src="${m.url}" muted loop></video>`
          : `<img src="${m.url}" loading="lazy">`
        }
        <div class="media-info">
          <p>${m.title || "Sans titre"}</p>
        </div>
      </div>
    `).join("");

    bind();

  } catch {
    slider.innerHTML = "<p class='ui-error'>Erreur chargement</p>";
  }
}

// =========================
// INTERACTIONS
// =========================
function bind() {

  document.querySelectorAll(".premium-card").forEach(card => {

    const video = card.querySelector("video");

    card.addEventListener("mouseenter", () => {
      if (video) video.play();
    });

    card.addEventListener("mouseleave", () => {
      if (video) video.pause();
    });

    card.addEventListener("click", () => {
      localStorage.setItem("focusMedia", card.dataset.id);
      window.location.href = "/gallery.html";
    });

  });

}

// =========================
// AUTO SLIDE
// =========================
setInterval(() => {

  if (!slider) return;

  slider.scrollLeft += 2;

  if (slider.scrollLeft >= slider.scrollWidth - slider.clientWidth) {
    slider.scrollLeft = 0;
  }

}, 30);

// =========================
// BTN
// =========================
document.getElementById("viewAll")?.addEventListener("click", () => {
  window.location.href = "/gallery.html";
});

// INIT
if (slider) loadTrending();
