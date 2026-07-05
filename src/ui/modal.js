// Generic Yes/No confirm modal. Owns its own callback state and wiring since
// there is exactly one instance of this modal in the DOM, shared by every
// feature that needs a confirmation prompt.
let confirmCallback = null;

export function showConfirmModal(message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmMessage').innerText = message;
  confirmCallback = onConfirm;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

export function initConfirmModal() {
  document.addEventListener('click', function(e) {
    const modal = document.getElementById('confirmModal');
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      confirmCallback = null;
    }
  });

  document.getElementById('confirmYesBtn').addEventListener('click', function() {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  document.getElementById('confirmNoBtn').addEventListener('click', function() {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    confirmCallback = null;
  });
}
