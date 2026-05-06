// =========================
// IMPORTS
// =========================
import API from "/js/api-core.js";
import URLS from "/js/url.js";
import UI from "/js/uisystem.js";

// =========================
// MAGAZSTARS CORE
// =========================
const MagazStars = {};

// =========================
// CONFIG
// =========================
MagazStars.config = {

  latestLimit: 12,
  featuredLimit: 10,
  trendingLimit: 10,

  autoScrollSpeed: 1,
  autoScrollInterval: 25

};

// =========================
// STATE
// =========================
MagazStars.state = {

  latest: [],
  featured: [],
  trending: [],

  initialized: false

};

// =========================
// DOM HELPERS
// =========================
MagazStars.get = (selector) =>
  document.querySelector(selector);

MagazStars.getAll = (selector) =>
  document.querySelectorAll(selector);

// =========================
// MEDIA SCORE
// FRONTEND FALLBACK RANKING
// =========================
MagazStars.computeScore = (media) => {

  const likes = media.likes || 0;
  const views = media.views || 0;
  const featured = media.featured ? 100 : 0;

  const ageHours =
    (
      Date.now() -
      new Date(
        media.createdAt ||
        media.created_at ||
        Date.now()
      ).getTime()
    ) / 3600000;

  const freshness =
    Math.max(0, 72 - ageHours);

  return (
    likes * 5 +
    views * 1 +
    featured +
    freshness
  );
};

// =========================
// SORT HELPERS
// =========================
MagazStars.sortTrending = (list = []) => {

  return [...list]
    .sort(
      (a, b) =>
        MagazStars.computeScore(b) -
        MagazStars.computeScore(a)
    );
};

MagazStars.sortLatest = (list = []) => {

  return [...list]
    .sort((a, b) => {

      const da = new Date(
        a.createdAt ||
        a.created_at ||
        0
      ).getTime();

      const db = new Date(
        b.createdAt ||
        b.created_at ||
        0
      ).getTime();

      return db - da;
    });
};

// =========================
// PREMIUM CARD
// =========================
MagazStars.createCard = (media = {}) => {

  const card = document.createElement("article");

  card.className =
    "premium-card card shimmer";

  card.dataset.id = media.id || "";

  const mediaHTML =
    media.type === "video"
      ? `
        <video
          src="${media.url || ""}"
          muted
          preload="metadata"
        ></video>
      `
      : `
        <img
          src="${media.url || ""}"
          loading="lazy"
          alt="${media.title || "media"}"
        />
      `;

  card.innerHTML = `

    ${mediaHTML}

    <div class="media-info">

      <h3>
        ${media.title || "Untitled"}
      </h3>

      <p>
        👁 ${media.views || 0}
        ·
        ❤️ ${media.likes || 0}
      </p>

      <div class="media-actions">

        <button class="btn open-btn">
          Ouvrir
        </button>

      </div>

    </div>
  `;

  // =========================
  // OPEN
  // =========================
  card
    .querySelector(".open-btn")
    ?.addEventListener("click", () => {

      MagazStars.openMedia(media.id);

    });

  // =========================
  // CLICK CARD
  // =========================
  card.addEventListener("click", (e) => {

    if (
      e.target.classList.contains("open-btn")
    ) return;

    MagazStars.openMedia(media.id);

  });

  return card;
};

// =========================
// OPEN MEDIA
// =========================
MagazStars.openMedia = async (id) => {

  if (!id) return;

  try {

    localStorage.setItem(
      "focusMedia",
      id
    );

    // add view
    API.media.view(id).catch(() => {});

    URLS.goGallery();

  } catch {

    URLS.goGallery();

  }
};

// =========================
// RENDER
// =========================
MagazStars.render = (
  selector,
  list = []
) => {

  const container =
    MagazStars.get(selector);

  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {

    UI.empty?.(
      container,
      "Aucun contenu"
    );

    return;
  }

  const fragment =
    document.createDocumentFragment();

  list.forEach(media => {

    fragment.appendChild(
      MagazStars.createCard(media)
    );

  });

  container.appendChild(fragment);
};

// =========================
// LOAD PUBLIC MEDIA
// =========================
MagazStars.loadPublic = async () => {

  const res =
    await API.get(
      URLS.query(
        URLS.api.media.public,
        {
          limit: 50
        }
      )
    );

  return (
    res.data ||
    res.media ||
    []
  );
};

// =========================
// LOAD TRENDING
// =========================
MagazStars.loadTrending =
  async (
    selector = "#trendingSlider"
  ) => {

    try {

      const media =
        await MagazStars.loadPublic();

      const sorted =
        MagazStars
          .sortTrending(media)
          .slice(
            0,
            MagazStars
              .config
              .trendingLimit
          );

      MagazStars.state.trending =
        sorted;

      MagazStars.render(
        selector,
        sorted
      );

    } catch {

      console.error(
        "Trending load failed"
      );

    }
  };

// =========================
// LOAD FEATURED
// =========================
MagazStars.loadFeatured =
  async (
    selector = "#featuredSlider"
  ) => {

    try {

      const media =
        await MagazStars.loadPublic();

      const featured =
        media
          .filter(m => m.featured)
          .slice(
            0,
            MagazStars
              .config
              .featuredLimit
          );

      MagazStars.state.featured =
        featured;

      MagazStars.render(
        selector,
        featured
      );

    } catch {

      console.error(
        "Featured load failed"
      );

    }
  };

// =========================
// LOAD LATEST
// =========================
MagazStars.loadLatest =
  async (
    selector = "#latestGrid"
  ) => {

    try {

      const media =
        await MagazStars.loadPublic();

      const latest =
        MagazStars
          .sortLatest(media)
          .slice(
            0,
            MagazStars
              .config
              .latestLimit
          );

      MagazStars.state.latest =
        latest;

      MagazStars.render(
        selector,
        latest
      );

    } catch {

      console.error(
        "Latest load failed"
      );

    }
  };

// =========================
// AUTO SLIDER
// =========================
MagazStars.autoScroll =
  (selector) => {

    const el =
      MagazStars.get(selector);

    if (!el) return;

    let paused = false;

    el.addEventListener(
      "mouseenter",
      () => paused = true
    );

    el.addEventListener(
      "mouseleave",
      () => paused = false
    );

    setInterval(() => {

      if (paused) return;

      el.scrollLeft +=
        MagazStars
          .config
          .autoScrollSpeed;

      if (
        el.scrollLeft +
        el.clientWidth >=
        el.scrollWidth
      ) {

        el.scrollLeft = 0;

      }

    },
    MagazStars
      .config
      .autoScrollInterval);

  };

// =========================
// LIKE
// =========================
MagazStars.like =
  async (id) => {

    if (!id) return;

    try {

      await API.media.like(id);

      UI.toast?.("Like ajouté");

    } catch {

      UI.toast?.(
        "Connexion requise",
        "error"
      );

    }
  };

// =========================
// INIT
// =========================
MagazStars.init = async () => {

  if (
    MagazStars
      .state
      .initialized
  ) return;

  MagazStars.state.initialized =
    true;

  await Promise.all([

    MagazStars.loadTrending(),
    MagazStars.loadFeatured(),
    MagazStars.loadLatest()

  ]);

  MagazStars.autoScroll(
    "#trendingSlider"
  );

  MagazStars.autoScroll(
    "#featuredSlider"
  );

};

// =========================
// AUTO INIT
// =========================
document.addEventListener(
  "DOMContentLoaded",
  () => {

    MagazStars.init();

  }
);

// =========================
// EXPORT
// =========================
export default MagazStars;