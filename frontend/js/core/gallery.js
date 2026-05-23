// frontend/js/gallery.js
import { getMediaGallery, likeMedia, addView, getMediaById } from '/js/api.js';

let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let currentMediaId = null;
let currentFilters = { type: 'all', search: '', sort: 'date' };
let searchDebounceTimer = null;

const grid = document.getElementById('gallery');
const paginationDiv = document.getElementById('galleryPagination');
const modal = document.getElementById('mediaModal');
const modalClose = document.querySelector('.modal-close');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalLikes = document.getElementById('modalLikes');
const modalViews = document.getElementById('modalViews');
const modalLikeBtn = document.getElementById('modalLikeBtn');
const modalDownloadBtn = document.getElementById('modalDownloadBtn');
const modalShareBtn = document.getElementById('modalShareBtn');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const filterBtns = document.querySelectorAll('.filter-btn');

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showMessage(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    alert(message);
  }
}

function showSkeleton(limit = 12) {
  grid.innerHTML = '';
  for (let i = 0; i < limit; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'gallery-card skeleton';
    skeleton.innerHTML = '<div class="skeleton-img"></div><div class="skeleton-text"></div>';
    grid.appendChild(skeleton);
  }
}

async function loadGallery(page = 1, limit = 12) {
  if (isLoading) return;
  isLoading = true;
  showSkeleton(limit);
  try {
    const data = await getMediaGallery('public', page, limit, currentFilters.type, currentFilters.search, currentFilters.sort);
    const mediaList = data.media || [];
    totalPages = data.pagination?.pages || 1;
    if (page === 1) grid.innerHTML = '';
    if (mediaList.length === 0 && page === 1) {
      grid.innerHTML = '<p class="ui-empty">Aucun média trouvé</p>';
      paginationDiv.innerHTML = '';
      return;
    }
    mediaList.forEach(media => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.dataset.id = media.id;
      const src = media.r2_key || media.url;
      card.innerHTML = `
        ${media.type === 'video'
          ? `<video src="${src}" muted preload="metadata" poster="${media.thumbnail || ''}"></video>`
          : `<img src="${src}" loading="lazy" alt="${escapeHtml(media.title || 'Sans titre')}">`
        }
        <div class="gallery-card-info">
          <h4>${escapeHtml(media.title || 'Sans titre')}</h4>
          <div class="gallery-stats">
            <span>❤️ ${media.likes || 0}</span>
            <span>👁️ ${media.views || 0}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => openModal(media.id));
      grid.appendChild(card);
    });
    renderPagination(page);
  } catch (err) {
    console.error('Load gallery error:', err);
    if (page === 1) grid.innerHTML = '<p class="ui-error">Erreur chargement galerie</p>';
  } finally {
    isLoading = false;
  }
}

function renderPagination(page) {
  if (totalPages <= 1) {
    paginationDiv.innerHTML = '';
    return;
  }
  let html = '';
  if (page > 1) html += `<button class="page-btn" data-page="${page-1}">◀ Précédent</button>`;
  html += `<span class="page-current">Page ${page} / ${totalPages}</span>`;
  if (page < totalPages) html += `<button class="page-btn" data-page="${page+1}">Suivant ▶</button>`;
  paginationDiv.innerHTML = html;
  document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const newPage = parseInt(btn.dataset.page);
      if (!isNaN(newPage)) loadGallery(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

async function openModal(mediaId) {
  currentMediaId = mediaId;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  modalMedia.innerHTML = '<div class="loader">Chargement...</div>';
  try {
    const data = await getMediaById(mediaId);
    const media = data.media;
    const src = media.r2_key || media.url;
    modalMedia.innerHTML = media.type === 'video'
      ? `<video controls src="${src}" poster="${media.thumbnail || ''}"></video>`
      : `<img src="${src}" alt="${escapeHtml(media.title)}">`;
    modalTitle.innerText = media.title || 'Sans titre';
    modalDescription.innerText = media.description || 'Aucune description';
    modalLikes.innerText = media.likes || 0;
    modalViews.innerText = media.views || 0;
    modalLikeBtn.innerText = '❤️ Like';
    modalLikeBtn.disabled = false;
    if (sessionStorage.getItem(`liked_${mediaId}`) === 'true') {
      modalLikeBtn.innerText = '❤️ Liké';
      modalLikeBtn.disabled = true;
    }
    const viewedKey = `viewed_${mediaId}`;
    if (!sessionStorage.getItem(viewedKey)) {
      await addView(mediaId);
      sessionStorage.setItem(viewedKey, '1');
      modalViews.innerText = (media.views || 0) + 1;
    }
  } catch (err) {
    console.error('Open modal error:', err);
    modalMedia.innerHTML = '<p class="error">Impossible de charger ce média.</p>';
  }
}

async function handleLike() {
  if (!currentMediaId) return;
  const token = localStorage.getItem('token');
  if (!token) {
    showMessage('Vous devez être connecté pour liker', 'error');
    return;
  }
  if (sessionStorage.getItem(`liked_${currentMediaId}`) === 'true') {
    showMessage('Vous avez déjà liké ce média', 'info');
    return;
  }
  try {
    await likeMedia(currentMediaId);
    sessionStorage.setItem(`liked_${currentMediaId}`, 'true');
    const currentLikes = parseInt(modalLikes.innerText);
    modalLikes.innerText = currentLikes + 1;
    modalLikeBtn.innerText = '❤️ Liké';
    modalLikeBtn.disabled = true;
    showMessage('Média liké !', 'success');
  } catch (err) {
    console.error('Like error:', err);
    showMessage('Erreur lors du like', 'error');
  }
}

function downloadMedia() {
  if (!currentMediaId) return;
  const modalImg = modalMedia.querySelector('img');
  const modalVideo = modalMedia.querySelector('video');
  if (modalImg) {
    const a = document.createElement('a');
    a.href = modalImg.src;
    a.download = `media_${currentMediaId}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else if (modalVideo) {
    const a = document.createElement('a');
    a.href = modalVideo.src;
    a.download = `media_${currentMediaId}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

async function shareMedia() {
  if (!currentMediaId) return;
  const url = `${window.location.origin}/gallery.html?id=${currentMediaId}`;
  try {
    await navigator.clipboard.writeText(url);
    showMessage('Lien copié !', 'success');
  } catch (err) {
    showMessage('Erreur lors de la copie', 'error');
  }
}

function setupFilters() {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilters.type = btn.dataset.type;
      currentPage = 1;
      loadGallery(currentPage);
    });
  });
  searchInput.addEventListener('input', (e) => {
    let value = e.target.value;
    if (value.length > 100) {
      value = value.slice(0, 100);
      searchInput.value = value;
    }
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentFilters.search = value;
      currentPage = 1;
      loadGallery(currentPage);
    }, 300);
  });
  sortSelect.addEventListener('change', (e) => {
    currentFilters.sort = e.target.value;
    currentPage = 1;
    loadGallery(currentPage);
  });
}

function setupEvents() {
  modalClose.addEventListener('click', () => {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  });
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  modalLikeBtn.addEventListener('click', handleLike);
  modalDownloadBtn.addEventListener('click', downloadMedia);
  modalShareBtn.addEventListener('click', shareMedia);
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { logout } = await import('/js/auth.js');
      logout();
    });
  }
}

function getMediaIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

document.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  setupFilters();
  await loadGallery(1, 12);
  const focusId = getMediaIdFromURL();
  if (focusId) setTimeout(() => openModal(focusId), 300);
});