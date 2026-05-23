// frontend/js/ui.js
// Interface utilisateur générique : toasts, modals, loaders, confirmations
// Version sécurisée avec échappement HTML (DOMPurify optionnel)

let toastTimeout = null;
let activeModal = null;
let globalLoader = null;
let escapeHandler = null;

// =========================
// ÉCHAPPEMENT HTML (anti-XSS)
// =========================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// Si DOMPurify est chargé, on l'utilise pour du HTML sécurisé, sinon on échappe.
let sanitize = (html) => escapeHtml(html);
if (typeof window.DOMPurify !== 'undefined') {
  sanitize = (html) => window.DOMPurify.sanitize(html);
}

// =========================
// TOAST NOTIFICATIONS
// =========================
export function showToast(message, type = 'info', duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.textContent = message; // textContent = pas de XSS
  toast.style.display = 'block';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// =========================
// MODAL (générique)
// =========================
function handleEscape(e) {
  if (e.key === 'Escape' && activeModal) {
    closeModal();
  }
}

export function openModal(content, options = {}) {
  if (activeModal) closeModal();

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('tabindex', '-1'); // focus trap commence

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const closeBtn = document.createElement('span');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Fermer');

  if (options.title) {
    const titleEl = document.createElement('h2');
    titleEl.textContent = options.title; // textContent = sûr
    modalContent.appendChild(titleEl);
  }

  if (typeof content === 'string') {
    const contentDiv = document.createElement('div');
    // Utilisation du sanitizer (DOMPurify ou simple échappement)
    contentDiv.innerHTML = sanitize(content);
    modalContent.appendChild(contentDiv);
  } else if (content instanceof HTMLElement) {
    modalContent.appendChild(content);
  }

  modalContent.appendChild(closeBtn);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  modal.style.display = 'flex';
  activeModal = modal;

  // Focus sur le modal
  modal.focus();

  const closeHandler = () => closeModal();
  closeBtn.addEventListener('click', closeHandler);

  if (options.closeOnOverlay !== false) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (options.onClose) {
    modal.addEventListener('modal-closed', options.onClose);
  }

  // Gestion de la touche Escape
  if (!escapeHandler) {
    escapeHandler = handleEscape;
    document.addEventListener('keydown', escapeHandler);
  }

  return modal;
}

export function closeModal() {
  if (activeModal && activeModal.parentNode) {
    const event = new Event('modal-closed');
    activeModal.dispatchEvent(event);
    activeModal.remove();
  }
  activeModal = null;
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }
}

// =========================
// CONFIRMATION
// =========================
export function confirmDialog(message, onConfirm, onCancel = null) {
  const modalContent = document.createElement('div');
  modalContent.style.textAlign = 'center';
  modalContent.innerHTML = `
    <p>${escapeHtml(message)}</p>
    <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
      <button id="confirmYes" class="btn-primary">Oui</button>
      <button id="confirmNo" class="btn-outline">Non</button>
    </div>`;
  const modal = openModal(modalContent, { title: 'Confirmation', closeOnOverlay: false });
  const yesBtn = modal.querySelector('#confirmYes');
  const noBtn = modal.querySelector('#confirmNo');
  yesBtn.addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });
  noBtn.addEventListener('click', () => {
    closeModal();
    if (onCancel) onCancel();
  });
}

// =========================
// SKELETON LOADER
// =========================
export function showSkeleton(container, count = 3, type = 'card') {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    if (type === 'card') {
      skeleton.innerHTML = '<div class="skeleton-img"></div><div class="skeleton-text"></div>';
    } else {
      skeleton.innerHTML = '<div class="skeleton-line"></div>';
    }
    container.appendChild(skeleton);
  }
}

export function hideSkeleton(container) {
  if (container) {
    const skeletons = container.querySelectorAll('.skeleton');
    skeletons.forEach(s => s.remove());
  }
}

// =========================
// GLOBAL LOADER (optionnel, sans ajout CSS si classes existent)
// =========================
export function showGlobalLoader() {
  if (globalLoader) return;
  globalLoader = document.createElement('div');
  globalLoader.className = 'global-loader';
  globalLoader.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(globalLoader);
}

export function hideGlobalLoader() {
  if (globalLoader) {
    globalLoader.remove();
    globalLoader = null;
  }
}

// =========================
// EXPORT PAR DÉFAUT (corrigé)
// =========================
export default {
  showToast,
  openModal,
  closeModal,
  confirmDialog,
  showSkeleton,
  hideSkeleton,
  showGlobalLoader,
  hideGlobalLoader
};