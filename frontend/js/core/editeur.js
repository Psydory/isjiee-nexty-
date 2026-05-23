// frontend/js/editor.js
let editMode = false;

export function toggleEditMode() {
  editMode = !editMode;
  const editableElements = document.querySelectorAll('[data-editable="true"]');
  editableElements.forEach(el => {
    el.contentEditable = editMode;
    el.style.border = editMode ? '2px dashed #F59E0B' : 'none';
  });
  localStorage.setItem('editMode', editMode);
}

export function initEditableElements() {
  const saved = localStorage.getItem('editMode') === 'true';
  if (saved) {
    // Petit délai pour que le DOM soit prêt
    setTimeout(() => toggleEditMode(), 100);
  }
}