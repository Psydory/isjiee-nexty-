// =========================
// UI SYSTEM — POLISH
// =========================
const UI = {};
UI.root = document.body;

// =========================
// TOAST (QUEUE)
// =========================
UI.queue = [];
UI.isShowing = false;

UI.toast = (message, type = "success") => {
  UI.queue.push({ message, type });
  if (!UI.isShowing) UI.nextToast();
};

UI.nextToast = () => {
  if (!UI.queue.length) {
    UI.isShowing = false;
    return;
  }

  UI.isShowing = true;
  const { message, type } = UI.queue.shift();

  const el = document.createElement("div");
  el.className = `ui-toast ${type} fade-in`;
  el.setAttribute("role", "status");
  el.textContent = message;

  UI.root.appendChild(el);

  requestAnimationFrame(() => el.classList.add("show"));

  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => {
      el.remove();
      UI.nextToast();
    }, 250);
  }, 2500);
};

// =========================
// GLOBAL LOADER
// =========================
UI.loader = null;

UI.showLoader = (text = "Chargement...") => {
  if (UI.loader) return;

  const el = document.createElement("div");
  el.className = "ui-global-loader";
  el.innerHTML = `
    <div class="spinner"></div>
    <p>${text}</p>
  `;

  UI.root.appendChild(el);
  UI.loader = el;
};

UI.hideLoader = () => {
  if (UI.loader) {
    UI.loader.remove();
    UI.loader = null;
  }
};

// =========================
// SKELETON (perception vitesse)
// =========================
UI.skeleton = (container, count = 6) => {
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const sk = document.createElement("div");
    sk.className = "card skeleton";
    sk.innerHTML = `<div class="skeleton-media"></div><div class="skeleton-line"></div>`;
    container.appendChild(sk);
  }
};

// =========================
// INLINE STATES
// =========================
UI.loading = (container) => {
  container.innerHTML = `<div class="ui-loading"><div class="spinner"></div></div>`;
};

UI.error = (container, msg = "Erreur") => {
  container.innerHTML = `<div class="ui-error">${msg}</div>`;
};

UI.empty = (container, msg = "Aucun contenu") => {
  container.innerHTML = `<div class="ui-empty">${msg}</div>`;
};

// =========================
// MODAL + FOCUS TRAP
// =========================
UI.modal = (html) => {
  const modal = document.createElement("div");
  modal.className = "ui-modal fade-in";
  modal.innerHTML = `<div class="ui-modal-content" role="dialog">${html}</div>`;

  const close = () => modal.remove();
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  UI.root.appendChild(modal);
  return modal;
};

UI.confirm = (message = "Confirmer ?") =>
  new Promise(resolve => {
    const modal = UI.modal(`
      <p>${message}</p>
      <div class="actions">
        <button class="btn yes">Oui</button>
        <button class="btn no">Non</button>
      </div>
    `);

    modal.querySelector(".yes").onclick = () => { modal.remove(); resolve(true); };
    modal.querySelector(".no").onclick = () => { modal.remove(); resolve(false); };
  });

// =========================
// MICRO-INTERACTIONS (hover / click)
// =========================
UI.bindInteractions = () => {

  // Ripple effect on buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn) return;

    const ripple = document.createElement("span");
    ripple.className = "ripple";
    btn.appendChild(ripple);

    const rect = btn.getBoundingClientRect();
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;

    setTimeout(() => ripple.remove(), 400);
  });

  // Lazy image reveal
  document.addEventListener("load", (e) => {
    if (e.target.tagName === "IMG") {
      e.target.classList.add("loaded");
    }
  }, true);
};

// =========================
// PREFETCH (perception rapide)
// =========================
UI.prefetch = (url) => {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  document.head.appendChild(link);
};

// =========================
// API HELPER
// =========================
UI.api = async (fn, { loader = false } = {}) => {
  try {
    if (loader) UI.showLoader();
    return await fn();
  } catch (err) {
    UI.toast(err.message || "Erreur", "error");
    throw err;
  } finally {
    if (loader) UI.hideLoader();
  }
};

// =========================
// INIT GLOBAL
// =========================
UI.init = () => {
  UI.bindInteractions();
};

UI.init();

export default UI;
