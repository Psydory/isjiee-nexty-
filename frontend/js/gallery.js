// =========================
// STATE
// =========================
let page = 1;
let loading = false;
let finished = false;

// =========================
// LOAD
// =========================
async function loadPage() {

  if (loading || finished) return;
  loading = true;

  try {

    let res;

    // 🔥 même logique que MagazStars
    if (page === 1) {

      try {
        res = await API.media.getPersonalized();
      } catch {
        try {
          res = await API.media.getTrending();
        } catch {
          res = await API.media.getLatest(page);
        }
      }

    } else {
      res = await API.media.getLatest(page);
    }

    const list = res.media || res.data || [];

    if (!list.length) {
      finished = true;
      return;
    }

    render(list);

    page++;

  } catch {
    UI.toast("Erreur chargement", "error");
  }

  loading = false;
}