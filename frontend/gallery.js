import API from "/js/api-core.js";
import UI from "/js/uisystem.js";

const container = document.getElementById("gallery");

let page = 1;
let loading = false;
let finished = false;

// =========================
// LOAD PAGE
// =========================
async function loadPage() {

  if (loading || finished) return;

  loading = true;

  try {

    const res = await API.media.getPage(page, 10);

    if (!res.data.length) {
      finished = true;
      return;
    }

    render(res.data);

    page++;

  } catch (err) {
    UI.toast("Erreur chargement", "error");
  }

  loading = false;
}

// =========================
// RENDER
// =========================
function render(list) {

  list.forEach(m => {

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      ${m.type === "video"
        ? `<video src="${m.url}" controls loading="lazy"></video>`
        : `<img src="${m.url}" loading="lazy" />`
      }
      <p>${m.title}</p>
    `;

    container.appendChild(card);
  });
}

// =========================
// INFINITE SCROLL
// =========================
window.addEventListener("scroll", () => {

  if (
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - 200
  ) {
    loadPage();
  }
});

// =========================
// INIT
// =========================
loadPage();
