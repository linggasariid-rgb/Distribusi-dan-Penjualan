import { callApi } from '../../services/api.js';
import { showConfirmModal } from '../../ui/modal.js';

const TABLE_LABELS = {
  penjualan_who: 'Penjualan WHO',
  distribusi: 'Distribusi',
  penerimaan: 'Penerimaan Pabrik',
};

function formatWaktu(iso) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.querySelector('span').innerText = msg;
  toast.classList.remove('translate-y-32', 'opacity-0');
  setTimeout(() => { toast.classList.add('translate-y-32', 'opacity-0'); }, 4000);
}

export function loadInputHistory(table, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<p class="text-xs p-2" style="color:var(--color-text-muted)">Memuat riwayat...</p>';

  callApi('getInputHistory', table).then(function(resp) {
    if (resp.status !== 'success') {
      container.innerHTML = `<p class="text-xs p-2 text-red-500">${resp.message}</p>`;
      return;
    }
    if (!resp.batches || resp.batches.length === 0) {
      container.innerHTML = '<p class="text-xs p-2" style="color:var(--color-text-muted)">Belum ada input dalam 3 hari terakhir.</p>';
      return;
    }

    let html = '<div class="divide-y" style="border-color:var(--color-border)">';
    resp.batches.forEach(b => {
      html += `
        <div class="flex items-center justify-between gap-3 py-2.5">
          <div class="text-xs">
            <div class="font-semibold" style="color:var(--color-text)">${formatWaktu(b.createdAt)}</div>
            <div style="color:var(--color-text-muted)">${b.count} baris &middot; ${b.groupCount} cabang/gudang &middot; Total ${b.sumJumlah.toLocaleString('id-ID')}</div>
          </div>
          <button class="btn btn-danger btn-sm" data-delete-batch="${b.createdAt}" data-table="${table}" data-container="${containerId}" data-count="${b.count}" data-sum="${b.sumJumlah}">
            <i class="fas fa-trash"></i> Hapus
          </button>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }).catch(function(err) {
    container.innerHTML = `<p class="text-xs p-2 text-red-500">Gagal memuat riwayat: ${err.message}</p>`;
  });
}

function deleteInputBatch(table, createdAt, containerId, count, sumJumlah) {
  const label = TABLE_LABELS[table] || table;
  const waktu = formatWaktu(createdAt);
  showConfirmModal(
    `Hapus batch input ${label} jam ${waktu} (${count} baris, total ${sumJumlah.toLocaleString('id-ID')})? Aksi ini TIDAK BISA dibatalkan.`,
    function() {
      callApi('deleteInputBatch', table, createdAt).then(function(resp) {
        if (resp.status === 'success') {
          showToast(resp.message);
          loadInputHistory(table, containerId);
        } else {
          alert('Gagal: ' + resp.message);
        }
      }).catch(function(err) {
        alert('Gagal terhubung ke server: ' + err.message);
      });
    }
  );
}

export function initInputHistoryEvents() {
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-delete-batch]');
    if (!btn) return;
    deleteInputBatch(
      btn.dataset.table,
      btn.dataset.deleteBatch,
      btn.dataset.container,
      parseInt(btn.dataset.count, 10),
      parseInt(btn.dataset.sum, 10)
    );
  });
}
