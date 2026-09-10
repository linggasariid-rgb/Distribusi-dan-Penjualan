import { callApi } from '../../services/api.js';
import { showConfirmModal } from '../../ui/modal.js';

const TABLE_LABELS = {
  penjualan_who: 'Penjualan',
  distribusi: 'Distribusi',
  penerimaan: 'Penerimaan Pabrik',
  penerimaan_cabang: 'Penerimaan Cabang',
  mutasi_cabang: 'Mutasi Cabang',
  retur_cabang: 'Retur / Kerugian'
};

let currentPage = 1;
const limit = 50;

function formatWaktu(iso) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.querySelector('span').innerText = msg;
  toast.classList.remove('translate-y-32', 'opacity-0');
  setTimeout(() => { toast.classList.add('translate-y-32', 'opacity-0'); }, 4000);
}

export function loadInputHistory(table, containerId, page = 1) {
  const container = document.getElementById(containerId);
  const btnPrev = document.getElementById('btn-riwayat-prev');
  const btnNext = document.getElementById('btn-riwayat-next');
  const pageInfo = document.getElementById('riwayat-page-info');
  
  if (!container) return;
  
  const startDate = document.getElementById('riwayat-start-date')?.value || '';
  const endDate = document.getElementById('riwayat-end-date')?.value || '';

  container.innerHTML = '<div class="p-8 text-center text-xs animate-pulse" style="color:var(--color-text-muted)">Memuat riwayat transaksi...</div>';

  callApi('getTransactionHistory', table, page, limit, startDate, endDate).then(function(resp) {
    if (resp.status !== 'success') {
      container.innerHTML = `<p class="text-xs p-4 text-red-500">${resp.message}</p>`;
      return;
    }
    
    currentPage = resp.page;
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= resp.totalPages;
    if (pageInfo) pageInfo.innerText = `Halaman ${currentPage} dari ${Math.max(1, resp.totalPages)} (Total: ${resp.total} baris)`;

    if (!resp.data || resp.data.length === 0) {
      container.innerHTML = '<p class="text-xs p-4" style="color:var(--color-text-muted)">Belum ada data transaksi yang sesuai filter.</p>';
      return;
    }

    let headers = [];
    if (table === 'penjualan_who') headers = ['Waktu Input', 'Tanggal', 'Cabang', 'Produk', 'Total Qty', 'Aksi'];
    else if (table === 'penerimaan') headers = ['Waktu Input', 'Tanggal', 'Gudang', 'Produk', 'Total Qty', 'Aksi'];
    else if (table === 'distribusi') headers = ['Waktu Input', 'Tanggal', 'Gudang Asal', 'Cabang Tujuan', 'Produk', 'Total Qty', 'Aksi'];
    else if (table === 'penerimaan_cabang') headers = ['Waktu Input', 'Tanggal', 'Gudang Asal', 'Cabang Tujuan', 'Produk', 'Aksi'];
    else if (table === 'mutasi_cabang') headers = ['Waktu Input', 'Tanggal', 'Asal', 'Tujuan', 'Produk', 'Aksi'];
    else if (table === 'retur_cabang') headers = ['Waktu Input', 'Tanggal', 'Cabang', 'Keterangan', 'Produk', 'Aksi'];

    let html = '<table class="w-full text-left border-collapse"><thead style="background:var(--color-bg-secondary)"><tr>';
    headers.forEach(h => html += `<th class="p-3 text-xs font-semibold" style="color:var(--color-text-muted);border-bottom:1px solid var(--color-border)">${h}</th>`);
    html += '</tr></thead><tbody class="divide-y" style="border-color:var(--color-border)">';

    resp.data.forEach(r => {
      let productDetails = '';
      if (r.products) {
        const pArr = [];
        for (let k in r.products) pArr.push(`${k}: ${r.products[k]}`);
        productDetails = pArr.join(', ');
      }

      html += `<tr class="hover-bg" style="transition:background 0.2s">`;
      html += `<td class="p-3 text-xs" style="color:var(--color-text)">${formatWaktu(r.created_at)}</td>`;
      html += `<td class="p-3 text-xs" style="color:var(--color-text)">${r.tanggal || '-'}</td>`;
      
      if (table === 'penjualan_who') {
        html += `<td class="p-3 text-xs font-semibold" style="color:var(--color-text)">${r.cabang}</td>`;
      } else if (table === 'penerimaan') {
        html += `<td class="p-3 text-xs font-semibold" style="color:var(--color-text)">${r.gudang}</td>`;
      } else if (table === 'distribusi') {
        html += `<td class="p-3 text-xs" style="color:var(--color-text-muted)">${r.gudang}</td>`;
        html += `<td class="p-3 text-xs font-semibold" style="color:var(--color-text)">${r.cabang}</td>`;
      } else if (table === 'penerimaan_cabang') {
        html += `<td class="p-3 text-xs" style="color:var(--color-text-muted)">${r.gudang || '-'}</td>`;
        html += `<td class="p-3 text-xs font-semibold" style="color:var(--color-text)">${r.cabang}</td>`;
      } else if (table === 'mutasi_cabang') {
        html += `<td class="p-3 text-xs" style="color:var(--color-text-muted)">${r.cabang_asal}</td>`;
        html += `<td class="p-3 text-xs font-semibold" style="color:var(--color-text)">${r.cabang_tujuan}</td>`;
      } else if (table === 'retur_cabang') {
        html += `<td class="p-3 text-xs font-semibold" style="color:var(--color-text)">${r.cabang}</td>`;
        html += `<td class="p-3 text-xs" style="color:var(--color-text-muted)">${r.keterangan || '-'}</td>`;
      }

      html += `<td class="p-3 text-xs" style="color:var(--color-text-muted);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${productDetails}">${productDetails}</td>`;
      
      if (['penjualan_who', 'distribusi', 'penerimaan'].includes(table)) {
         html += `<td class="p-3 text-xs font-semibold" style="color:var(--color-text)">${(r.jumlah || 0).toLocaleString('id-ID')}</td>`;
      }

      html += `
        <td class="p-3">
          <button class="btn btn-danger btn-sm" data-delete-row="${r.id}" data-table="${table}" data-container="${containerId}">
            <i class="fas fa-trash"></i> Hapus
          </button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }).catch(function(err) {
    container.innerHTML = `<p class="text-xs p-4 text-red-500">Gagal memuat riwayat: ${err.message}</p>`;
  });
}

function deleteInputRow(table, id, containerId) {
  const label = TABLE_LABELS[table] || table;
  showConfirmModal(
    `Hapus baris data dari ${label}? (Aksi ini tidak bisa dibatalkan)`,
    function() {
      callApi('deleteRow', table, id).then(function(resp) {
        if (resp.status === 'success') {
          showToast(resp.message);
          loadInputHistory(table, containerId, currentPage);
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
    const btnRow = e.target.closest('[data-delete-row]');
    if (btnRow) {
      deleteInputRow(
        btnRow.dataset.table,
        btnRow.dataset.deleteRow,
        btnRow.dataset.container
      );
    }
    
    const btnPrev = e.target.closest('#btn-riwayat-prev');
    if (btnPrev && !btnPrev.disabled) {
      const select = document.getElementById('riwayat-transaksi-select');
      if (select) loadInputHistory(select.value, 'riwayat-transaksi-content', currentPage - 1);
    }

    const btnNext = e.target.closest('#btn-riwayat-next');
    if (btnNext && !btnNext.disabled) {
      const select = document.getElementById('riwayat-transaksi-select');
      if (select) loadInputHistory(select.value, 'riwayat-transaksi-content', currentPage + 1);
    }
  });

  const startDate = document.getElementById('riwayat-start-date');
  const endDate = document.getElementById('riwayat-end-date');
  if (startDate) {
    startDate.addEventListener('change', () => {
      const select = document.getElementById('riwayat-transaksi-select');
      if (select) loadInputHistory(select.value, 'riwayat-transaksi-content', 1);
    });
  }
  if (endDate) {
    endDate.addEventListener('change', () => {
      const select = document.getElementById('riwayat-transaksi-select');
      if (select) loadInputHistory(select.value, 'riwayat-transaksi-content', 1);
    });
  }
}
