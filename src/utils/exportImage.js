import { getExportBgColor } from '../ui/theme.js';
import { showToast } from '../ui/toast.js';

// Generic "screenshot a container, copy to clipboard, fall back to download"
// capture used by daily report, sales-per-date and best-produk.
export function capturePivot(containerId, filename, btnSelector, callback) {
  const btn = document.querySelector(btnSelector);
  const container = document.getElementById(containerId);
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  const parentView = container.closest('[class*="space-y-"]');
  const filterRow = parentView ? parentView.querySelector(':scope > div.flex') : null;

  const isSidebarOpen = sidebar.classList.contains('translate-x-0');
  const originalBtnText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Memproses...';
  btn.disabled = true;

  if (isSidebarOpen) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    mainContent.classList.remove('ml-64');
    mainContent.classList.add('ml-0');
  }

  if (filterRow) filterRow.style.display = 'none';

  setTimeout(() => {
    html2canvas(container, { scale: 3, useCORS: true, backgroundColor: getExportBgColor() })
      .then(canvas => {
        canvas.toBlob(blob => {
          try {
            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard.write([item]).then(() => {
              showToast("Screenshot disalin! Silakan Paste (Ctrl+V).");
            }).catch(() => {
              const link = document.createElement('a');
              link.download = filename;
              link.href = canvas.toDataURL('image/png');
              link.click();
            });
          } catch (e) {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        });
      }).catch(err => {
        console.error("Screenshot gagal:", err);
        alert("Gagal mengambil screenshot: " + err.message);
      }).finally(() => {
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
        if (filterRow) filterRow.style.display = '';
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        mainContent.classList.add('ml-0');
        mainContent.classList.remove('ml-64');
        if (callback) callback();
      });
  }, 300);
}
