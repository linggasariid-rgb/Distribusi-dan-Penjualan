import { callApi } from '../../services/api.js';

let allKontak = [];
let sudahInit = false;

// Data kontak berasal dari paste Excel, jadi isinya tidak dipercaya. Tanpa
// escaping, satu nama berisi <img onerror=...> akan dieksekusi setiap kali tabel
// dirender. Repo lama (rekapBelanja.js) tidak melakukan ini; modul baru
// tidak menirunya.
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Potong teks jadi array baris x kolom. Tab adalah pemisah kolom (hasil
// paste dari Excel), koma atau titik koma hanya jadi pemisah bila tidak
// ada tab sama sekali.
export function kontakToRows(text) {
  return text.split('\n')
    .map(r => r.replace(/\r$/, ''))
    .filter(r => r.trim() !== '')
    .map(r => (r.includes('\t') ? r.split('\t') : r.split(/[;,]/)));
}

function setStatus(msg, cls) {
  const el = document.getElementById('kontak-status');
  el.textContent = msg;
  el.className = 'text-sm font-semibold ' + cls;
}

function renderKontak() {
  const tbody = document.getElementById('kontak-tbody');
  document.getElementById('kontak-count').textContent = allKontak.length + ' kontak';

  if (allKontak.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Belum ada data kontak. Tempel blok dari Excel lalu klik Simpan.</td></tr>';
    return;
  }

  let html = '';
  allKontak.forEach((k, i) => {
    const tipe = String(k.type || '').toUpperCase();
    const badge = tipe === 'MST' ? 'bg-amber-100 text-amber-700'
      : tipe === 'MSI' ? 'bg-purple-100 text-purple-700'
      : 'bg-blue-100 text-blue-700';
    html += `<tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-2 text-slate-400 font-mono">${i + 1}</td>
      <td class="px-4 py-2 font-bold text-slate-700 whitespace-nowrap">${esc(k.nama)}</td>
      <td class="px-4 py-2 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${badge}">${esc(tipe)}</span></td>
      <td class="px-4 py-2 text-slate-600 whitespace-nowrap">${k.pemilik ? esc(k.pemilik) : '<span class="text-slate-300">—</span>'}</td>
      <td class="px-4 py-2 text-slate-600 font-mono whitespace-nowrap">${k.kontak ? esc(k.kontak) : '<span class="text-slate-300">—</span>'}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

// Satu-satunya tempat yang mengurus loader. saveKontakMitra dan hapusKontakMitra
// sengaja TIDAK menyentuh loader lalu memanggil fungsi ini: kalau keduanya
// managing loader sendiri, .finally() di luar akan menyembunyikan spinner
// selagi request berikutnya masih berjalan.
function loadKontak() {
  const loader = document.getElementById('kontak-loader');
  loader.classList.remove('hidden');
  loader.classList.add('flex');

  return callApi('getKontakMitra')
    .then(res => {
      allKontak = res.data || [];
      renderKontak();
    })
    .catch(err => setStatus('Gagal memuat kontak: ' + err.message, 'text-red-600'))
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    });
}

export function saveKontakMitra() {
  const input = document.getElementById('kontak-input');
  const raw = input.value.trim();

  if (!raw) {
    setStatus('Area paste masih kosong.', 'text-amber-600');
    return;
  }

  const rows = kontakToRows(raw);
  if (rows.length < 2) {
    setStatus('Minimal 2 baris (header + 1 data).', 'text-amber-600');
    return;
  }

  callApi('simpanKontakMitra', rows)
    .then(res => {
      const d = res.data || {};
      setStatus('Berhasil menyimpan ' + d.saved + ' kontak' +
        (d.skipped > 0 ? ', ' + d.skipped + ' baris dilewati.' : '.'), 'text-emerald-600');
      input.value = '';
      return loadKontak();
    })
    .catch(err => setStatus(err.message, 'text-red-600'));
}

export function hapusKontakMitra() {
  if (!confirm('Hapus SEMUA data kontak mitra? Tindakan ini tidak bisa dibatalkan.')) return;

  callApi('hapusKontakMitra', true)
    .then(() => {
      setStatus('Semua data kontak dihapus.', 'text-emerald-600');
      return loadKontak();
    })
    .catch(err => setStatus(err.message, 'text-red-600'));
}

export function initKontakMitra() {
  // Router memanggil ini setiap kali menu dibuka selama tbody masih kosong.
  // Tanpa penjaga, satu klik bisa memasang listener beberapa kali dan satu
  // klik Simpan jadi beberapa request.
  if (sudahInit) return;
  sudahInit = true;

  document.getElementById('btn-kontak-simpan').addEventListener('click', saveKontakMitra);
  document.getElementById('btn-kontak-hapus').addEventListener('click', hapusKontakMitra);
  setStatus('', 'text-slate-500');
  loadKontak();
}
