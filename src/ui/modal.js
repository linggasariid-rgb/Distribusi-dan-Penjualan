let confirmCallback = null;

export function showConfirmModal(message, onConfirm, options) {
  const modal = document.getElementById('confirmModal');
  const msgEl = document.getElementById('confirmMessage');
  const yesBtn = document.getElementById('confirmYesBtn');
  const noBtn = document.getElementById('confirmNoBtn');
  const titleEl = document.getElementById('confirmTitle');

  msgEl.innerText = message;
  confirmCallback = onConfirm;

  if (options) {
    if (titleEl) titleEl.textContent = options.title || 'Konfirmasi';
    if (yesBtn) {
      yesBtn.textContent = options.yesText || 'Ya, Muat Ulang';
      if (options.yesStyle) {
        yesBtn.style.background = options.yesStyle.background || '';
        yesBtn.style.color = options.yesStyle.color || '';
      }
    }
    if (noBtn) noBtn.textContent = options.noText || 'Tidak';
  } else {
    if (titleEl) titleEl.textContent = 'Konfirmasi';
    if (yesBtn) {
      yesBtn.textContent = 'Ya, Muat Ulang';
      yesBtn.style.background = '';
      yesBtn.style.color = '';
    }
    if (noBtn) noBtn.textContent = 'Tidak';
  }

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
