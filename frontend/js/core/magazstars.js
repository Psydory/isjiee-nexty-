// frontend/js/magazstars.js
import { getTrendingMedia, addView } from '/js/api.js';
import { logout } from '/js/auth.js';

let slider = null;
let animationId = null;
let speed = 1;
let autoSlideActive = true;
let redirecting = false;
let scrollTimeout = null;
let speedInterval = null;
let cardListeners = [];       // Stockage des listeners pour nettoyage

const MIN_SPEED = 0.5;
const MAX_SPEED = 2.5;
const SPEED_CHANGE_INTERVAL = 5000;

let mouseEnterHandler = null;
let mouseLeaveHandler = null;
let scrollHandler = null;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function sanitizeUrl(url) {
  if (!url) return '';
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return '';
  }
}

// Animation continue (ne meurt jamais)
function animateSlide() {
  if (slider && autoSlideActive && slider.scrollWidth > slider.clientWidth) {
    slider.scrollLeft += speed;
    if (slider.scrollLeft >= slider.scrollWidth - slider.clientWidth) {
      slider.scrollLeft = 0;
    }
  }
  animationId = requestAnimationFrame(animateSlide);
}

async function loadTrending() {
  if (!slider) return;
  slider.innerHTML = '<div class="loader">Chargement des tendances...</div>';
  try {
    const data = await getTrendingMedia(20);
    const mediaList = data.media || [];
    if (!mediaList.length) {
      slider.innerHTML = '<p class="ui-empty">Aucun contenu pour le moment</p>';
      return;
    }
    slider.innerHTML = mediaList.map(media => {
      const src = sanitizeUrl(media.r2_key || media.url);
      return `
        <div class="media-card premium-card" data-id="${media.id}" tabindex="0" role="button" aria-label="Voir ${escapeHtml(media.title || 'média')}">
          ${media.type === 'video'
            ? `<video src="${src}" muted loop preload="metadata" poster="${media.thumbnail || ''}" class="media-video"></video>`
            : `<img src="${src}" loading="lazy" alt="${escapeHtml(media.title || 'Sans titre')}" class="media-img">`
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
  if (!slider) return;
  const cards = slider.querySelectorAll('.premium-card');
  cards.forEach(card => {
    const video = card.querySelector('video');
    const handleActivate = async () => {
      if (redirecting) return;
      const mediaId = card.dataset.id;
      if (!mediaId) return;
      redirecting = true;
      try {
        await addView(mediaId);
      } catch (err) {}
      window.location.href = `/gallery.html?id=${mediaId}`;
      // Fallback pour débloquer redirecting au cas où la navigation échoue
      setTimeout(() => { redirecting = false; }, 5000);
    };
    const mouseEnterHandlerLocal = () => {
      if (video && video.readyState >= 2) video.play().catch(() => {});
    };
    const mouseLeaveHandlerLocal = () => {
      if (video) video.pause();
    };
    card.addEventListener('mouseenter', mouseEnterHandlerLocal);
    card.addEventListener('mouseleave', mouseLeaveHandlerLocal);
    card.addEventListener('click', handleActivate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivate();
      }
    });
    // Image fallback
    const img = card.querySelector('img');
    if (img) {
      img.onerror = () => {
        img.src = 'https://placehold.co/400x300/1e293b/94a3b8?text=Image+introuvable';
      };
    }
    // Stocker pour nettoyage
    cardListeners.push({
      card,
      mouseEnter: mouseEnterHandlerLocal,
      mouseLeave: mouseLeaveHandlerLocal,
      click: handleActivate
    });
  });
}

function startAutoSlide() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(animateSlide);
}

function stopAutoSlide() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function startSpeedVariation() {
  if (speedInterval) clearInterval(speedInterval);
  speedInterval = setInterval(() => {
    if (!autoSlideActive) return;
    speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.random() * 2 + 0.5));
  }, SPEED_CHANGE_INTERVAL);
}

function stopSpeedVariation() {
  if (speedInterval) {
    clearInterval(speedInterval);
    speedInterval = null;
  }
}

function handleMouseEnter() {
  autoSlideActive = false;
}

function handleMouseLeave() {
  autoSlideActive = true;
}

let scrollThrottle = false;
function handleManualScroll() {
  if (scrollThrottle) return;
  scrollThrottle = true;
  requestAnimationFrame(() => {
    if (!autoSlideActive) return;
    autoSlideActive = false;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      autoSlideActive = true;
      scrollThrottle = false;
    }, 3000);
    scrollThrottle = false;
  });
}

function cleanupCardListeners() {
  for (const item of cardListeners) {
    const { card, mouseEnter, mouseLeave, click } = item;
    card.removeEventListener('mouseenter', mouseEnter);
    card.removeEventListener('mouseleave', mouseLeave);
    card.removeEventListener('click', click);
  }
  cardListeners = [];
}

export function destroyMagazStars() {
  stopAutoSlide();
  stopSpeedVariation();
  if (slider) {
    if (mouseEnterHandler) slider.removeEventListener('mouseenter', mouseEnterHandler);
    if (mouseLeaveHandler) slider.removeEventListener('mouseleave', mouseLeaveHandler);
    if (scrollHandler) slider.removeEventListener('scroll', scrollHandler);
  }
  cleanupCardListeners();
  window.removeEventListener('beforeunload', destroyMagazStars);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopAutoSlide();
    stopSpeedVariation();
  } else {
    startAutoSlide();
    startSpeedVariation();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  slider = document.getElementById('mediaSlider');
  if (!slider) return;

  loadTrending();
  startAutoSlide();
  startSpeedVariation();

  mouseEnterHandler = handleMouseEnter;
  mouseLeaveHandler = handleMouseLeave;
  scrollHandler = handleManualScroll;

  slider.addEventListener('mouseenter', mouseEnterHandler);
  slider.addEventListener('mouseleave', mouseLeaveHandler);
  slider.addEventListener('scroll', scrollHandler);

  window.addEventListener('beforeunload', destroyMagazStars);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }

  const viewAllBtn = document.getElementById('viewAll');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      window.location.href = '/gallery.html';
    });
  }
});