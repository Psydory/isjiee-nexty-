// frontend/js/magazstars.js
import { getTrendingMedia, addView } from '/js/api.js';

let slider = null;
let autoScrollInterval = null;
let speed = 1;
let autoSlideActive = true;
let redirecting = false;
let scrollTimeout = null;

const MIN_SPEED = 0.5;
const MAX_SPEED = 2.5;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

async function loadTrending() {
  if (!slider) return;
  // Afficher un loader
  slider.innerHTML = '<div class="loader">Chargement des tendances...</div>';

  try {
    const data = await getTrendingMedia(20);
    const mediaList = data.media || [];
    if (!mediaList.length) {
      slider.innerHTML = '<p class="ui-empty">Aucun contenu pour le moment</p>';
      return;
    }
    slider.innerHTML = mediaList.map(media => {
      const src = media.r2_key || media.url;
      return `
        <div class="media-card premium-card" data-id="${media.id}">
          ${media.type === 'video'
            ? `<video src="${src}" muted loop preload="metadata" poster="${media.thumbnail || ''}"></video>`
            : `<img src="${src}" loading="lazy" alt="${escapeHtml(media.title || 'Sans titre')}">`
          }
          <div class="media-info">
            <p>${escapeHtml(media.title || 'Sans titre')}</p>
          </div>
        </div>
      `;
    }).join('');
    bindInteractions();
  } catch (err) {
    console.error('MagazStars error:', err);
    slider.innerHTML = '<p class="ui-error">Erreur chargement des médias</p>';
  }
}

function bindInteractions() {
  const cards = document.querySelectorAll('.premium-card');
  cards.forEach(card => {
    const video = card.querySelector('video');
    card.addEventListener('mouseenter', () => {
      if (video) video.play();
    });
    card.addEventListener('mouseleave', () => {
      if (video) video.pause();
    });
    card.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (redirecting) return;
      const mediaId = card.dataset.id;
      if (!mediaId) return;
      redirecting = true;
      try {
        await addView(mediaId);
      } catch (err) {
        console.warn('Failed to register view:', err);
      }
      window.location.href = `/gallery.html?id=${mediaId}`;
    });
  });
}

function startAutoSlide() {
  if (!slider) return;
  if (autoScrollInterval) clearInterval(autoScrollInterval);
  autoScrollInterval = setInterval(() => {
    if (!autoSlideActive) return;
    slider.scrollLeft += speed;
    // Variation aléatoire de la vitesse (dans les bornes)
    if (Math.random() > 0.98) {
      speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.random() * 2 + 0.5));
    }
    if (slider.scrollLeft >= slider.scrollWidth - slider.clientWidth) {
      slider.scrollLeft = 0;
    }
  }, 30);
}

function stopAutoSlide() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopAutoSlide();
  } else {
    startAutoSlide();
  }
}

function handleManualScroll() {
  // Désactiver l'auto-slide temporairement après un scroll manuel
  if (!autoSlideActive) return;
  autoSlideActive = false;
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    autoSlideActive = true;
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  slider = document.getElementById('mediaSlider');
  if (!slider) return;

  loadTrending();
  startAutoSlide();

  // Pause auto-slide au survol
  slider.addEventListener('mouseenter', () => { autoSlideActive = false; });
  slider.addEventListener('mouseleave', () => { autoSlideActive = true; });

  // Pause après un scroll manuel
  slider.addEventListener('scroll', handleManualScroll);

  // Nettoyage
  window.addEventListener('beforeunload', stopAutoSlide);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Déconnexion (si bouton présent)
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { logout } = await import('/js/auth.js');
      logout();
    });
  }
});