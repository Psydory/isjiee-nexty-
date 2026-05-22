// frontend/js/business.js
import { toggleEditMode, initEditableElements } from '/js/editor.js';

// Mode édition (admin)
const editBtn = document.getElementById('editModeBtn');
if (editBtn) {
  editBtn.addEventListener('click', toggleEditMode);
  initEditableElements();
}

// Gestion des onglets avec ARIA
const tabs = document.querySelectorAll('[role="tab"]');
const panels = {
  entrepreneur: document.getElementById('tab-entrepreneur'),
  wiggfluenceur: document.getElementById('tab-wiggfluenceur')
};

function activateTab(tabId) {
  // Désactiver tous les onglets et panneaux
  tabs.forEach(btn => {
    const isActive = btn.getAttribute('data-tab') === tabId;
    btn.setAttribute('aria-selected', isActive);
    btn.classList.toggle('active', isActive);
  });
  Object.values(panels).forEach(panel => {
    if (panel) panel.classList.remove('active');
  });
  if (panels[tabId]) panels[tabId].classList.add('active');
  localStorage.setItem('businessTab', tabId);
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    if (tabId === 'entrepreneur' || tabId === 'wiggfluenceur') {
      activateTab(tabId);
    }
  });
});

// Restaurer l'onglet sauvegardé
const savedTab = localStorage.getItem('businessTab');
if (savedTab && (savedTab === 'entrepreneur' || savedTab === 'wiggfluenceur')) {
  activateTab(savedTab);
} else {
  activateTab('entrepreneur');
}