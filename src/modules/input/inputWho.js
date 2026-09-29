import { state } from '../../state/appState.js';
import { submitPastedData } from './submitHelper.js';
import { showConfirmModal } from '../../ui/modal.js';

// Cerminan findNamaColumn() di worker/src/routes/save-penjualan-who.js. Kalau
// keduanya berbeda, peringatan di layar tidak akan cocok dengan perilaku server.
const NAMA_KEYWORDS = ['PDM', 'CUSTOMER', 'MITRA', 'PELANGGAN', 'TOKO', 'DISTRIBUTOR', 'PEMBELI', 'NASABAH', 'SUPLIER'];

function findNamaColumn(headers) {
  const exact = headers.findIndex(h => {
    const u = String(h || '').toUpperCase().trim();
    return u === 'NAMA PDM' || u === 'NAMA CUSTOMER' || u === 'NAMA MITRA' || u === 'NAMA PELANGGAN';
  });
  if (exact >= 0) return exact;
  return headers.findIndex(h => {
    const u = String(h || '').toUpperCase().trim();
    if (!u.includes('NAMA')) return false;
    return NAMA_KEYWORDS.some(k => u.includes(k));
  });
}

export function processPasteWHO() {
  const text = document.getElementById('penjualan-who-paste-area').value.trim();
  const container = document.getElementById('penjualan-who-preview');
  const submitContainer = document.getElementById('penjualan-who-submit-container');

  state.pastedDataCache['penjualan_who'] = null;

  if (!text) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Silakan paste data terlebih dahulu.</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  const rows = text.split('\n').filter(row => row.trim() !== '');
  let data = rows.map(row => row.split('\t'));

  if (data.length < 2) {
    container.innerHTML = '<p class="text-red-500 font-semibold p-4 bg-red-50 rounded-lg border border-red-200">Minimal 2 baris (header + 1 data).</p>';
    submitContainer.classList.add('hidden');
    return;
  }

  state.pastedDataCache['penjualan_who'] = data;

  let tableHTML = '<table class="w-full text-xs text-left border-collapse border border-slate-200"><thead class="bg-slate-100 sticky top-0"><tr class="text-slate-600 uppercase text-[10px] tracking-wider">';
  let htmlBody = '<tbody class="divide-y divide-slate-100">';

  data.forEach((row, i) => {
    if (i === 0) {
      row.forEach((c, j) => tableHTML += `<th class="px-4 py-3 font-bold border border-slate-200 whitespace-nowrap">${c || 'Kolom '+(j+1)}</th>`);
      tableHTML += '</tr></thead>';
    } else {
      htmlBody += '<tr class="hover:bg-slate-50">';
      row.forEach(c => htmlBody += `<td class="px-4 py-2 border border-slate-200 whitespace-nowrap">${c}</td>`);
      htmlBody += '</tr>';
    }
  });

  htmlBody += '</tbody></table>';
  container.innerHTML = tableHTML + htmlBody;

  // Peringatan SEBELUM simpan. Ini yang paling penting: tanpa ini, user baru
  // tahu setelah 2787 baris tersimpan tanpa nama (kejadian Agustus 2026).
  if (findNamaColumn(data[0].map(h => String(h || '').trim())) < 0) {
    const mirip = data[0].filter(h => /NAMA|CUSTOMER|MITRA|PELANGGAN|TOKO|DISTRIBUTOR|PEMBELI/i.test(String(h || '')));
    container.innerHTML += '<div class="mt-3 p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800">'
      + '<p class="font-bold mb-1">Kolom nama mitra tidak ditemukan pada baris header.</p>'
      + '<p>Semua baris akan tersimpan hanya sebagai kode (MST/MSI/STK) tanpa nama, dan kolom '
      + 'Pemilik/Kontak tidak akan muncul di menu Bandingkan Belanja.</p>'
      + '<p class="mt-1">Sertakan kolom <span class="font-mono font-bold">NAMA PDM</span>, '
      + '<span class="font-mono font-bold">NAMA CUSTOMER</span>, atau '
      + '<span class="font-mono font-bold">NAMA MITRA</span> di baris header.</p>'
      + (mirip.length ? '<p class="mt-1">Kolom yang mirip tapi tidak dikenali: <span class="font-mono">'
        + mirip.map(h => String(h)).join(', ') + '</span></p>' : '')
      + '<p class="mt-1 font-semibold">Pastikan baris pertama yang dipaste adalah header asli dari Excel, bukan baris data.</p>'
      + '</div>';
  }

  submitContainer.classList.remove('hidden');
}

export function submitDataWHO() {
  const button = document.querySelector('#penjualan-who-submit-container button');
  const replaceBox = document.getElementById('penjualan-who-replace');
  const replace = !!(replaceBox && replaceBox.checked);

  const doSubmit = () => {
    submitPastedData({
      rpcName: 'savePastedDataWHO',
      cacheKey: 'penjualan_who',
      idPrefix: 'penjualan-who',
      button: button,
      offerReload: true,
      historyTable: 'penjualan_who',
      historyContainerId: 'penjualan-who-history',
      extraArgs: [replace],
    });
  };

  // Mengganti bulan menghapus seluruh baris bulan tersebut sebelum menulis yang
  // baru, dan operation itu tidak bisa dibatalkan. Karena itu wajib ada konfirmasi
  // eksplisit -- checkbox centang saja belum cukup.
  if (replace) {
    showConfirmModal(
      'Seluruh data bulan yang ada di data yang sedang di-paste akan DIHAPUS PERMANEN, lalu diganti dengan data baru. Data bulan lain tidak tersentuh. Lanjutkan?',
      doSubmit,
      { title: 'Ganti data bulan?', yesText: 'Ya, hapus dan ganti', yesStyle: { background: '#dc2626' } }
    );
    return;
  }

  doSubmit();
}

export function clearWhoForm() {
  document.getElementById('penjualan-who-paste-area').value = '';
  document.getElementById('penjualan-who-preview').innerHTML = '';
  document.getElementById('penjualan-who-submit-container').classList.add('hidden');
  state.pastedDataCache['penjualan_who'] = null;
}
