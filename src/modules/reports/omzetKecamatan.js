import { callApi } from '../../services/api.js';
import { showToast } from '../../ui/toast.js';
import { gayaBaris, formatAngka, rapikanSheet } from '../../utils/excelRapi.js';

// Omzet per kecamatan -- Master Stokis (MST) + MSI.
// Backend mengembalikan satu baris per mitra (sudah membawa kecamatan/kota);
// pengelompokan dan filter dilakukan di sini supaya ganti cabang/kota tidak
// memanggil API lagi.

const BELUM = '(Belum terpetakan)';

let state = {
  bulan: '',
  banding: '',      // bulan pembanding ('' = tanpa perbandingan)
  modeBanding: false,
  gabung: [],       // gabungBulan(mitra bulan ini, mitra bulan banding)
  mitra: [],
  tidakBelanja: [], // mitra di data wilayah yang tidak belanja di bulan ini
  tbTerbuka: false,
  jumlahWilayah: 0,
  terbuka: new Set(), // kunci kecamatan yang sedang dibuka detail mitranya
};

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const num = n => Number(n || 0).toLocaleString('id-ID');
const persen = (a, b) => (b > 0 ? (a / b * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '-');

// Excel sumber punya ejaan ganda seperti "Karang Bahagia" / "Karangbahagia"
// dan "KabupatenTasikmalaya" -- kunci tanpa spasi/tanda baca menyatukannya.
export function kunciWilayah(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Dari beberapa ejaan dengan kunci sama, tampilkan yang paling "rapi"
// (paling banyak spasi), mis. "Kabupaten Tasikmalaya" bukan "KabupatenTasikmalaya".
function labelLebihRapi(lama, baru) {
  if (!lama) return baru;
  const spasi = s => (s.match(/\s/g) || []).length;
  return spasi(baru) > spasi(lama) ? baru : lama;
}

// Gabungkan mitra dua bulan jadi satu baris per (cabang, mitra): omzet/bungkus
// = bulan ini, omzet_banding/bungkus_banding = bulan pembanding. Mitra yang
// hanya belanja di salah satu bulan tetap muncul dengan nilai 0 di bulan lain.
export function gabungBulan(mitraIni, mitraBanding) {
  const map = new Map();
  const ambil = m => {
    const key = `${m.cabang}||${m.nama_customer}`;
    let g = map.get(key);
    if (!g) {
      g = { ...m, bungkus: 0, omzet: 0, bungkus_banding: 0, omzet_banding: 0 };
      map.set(key, g);
    }
    return g;
  };
  for (const m of mitraIni || []) {
    const g = ambil(m);
    g.bungkus += m.bungkus;
    g.omzet += m.omzet;
  }
  for (const m of mitraBanding || []) {
    const g = ambil(m);
    g.bungkus_banding += m.bungkus;
    g.omzet_banding += m.omzet;
  }
  return [...map.values()];
}

export function kelompokkan(mitra) {
  const kotaMap = new Map();
  const tambah = (g, m) => {
    g.bungkus += m.bungkus || 0;
    g.omzet += m.omzet || 0;
    g.bungkus_banding += m.bungkus_banding || 0;
    g.omzet_banding += m.omzet_banding || 0;
  };
  for (const m of mitra) {
    const ok = m.terpetakan && m.kecamatan;
    const kKota = ok ? kunciWilayah(m.kota) || '-' : BELUM;
    const kKec = ok ? kunciWilayah(m.kecamatan) : BELUM;

    let kota = kotaMap.get(kKota);
    if (!kota) {
      kota = { key: kKota, label: '', provinsi: '', bungkus: 0, omzet: 0, bungkus_banding: 0, omzet_banding: 0, kecMap: new Map(), belum: !ok };
      kotaMap.set(kKota, kota);
    }
    kota.label = ok ? labelLebihRapi(kota.label, m.kota || '-') : BELUM;
    if (!kota.provinsi && m.provinsi) kota.provinsi = m.provinsi;
    tambah(kota, m);

    let kec = kota.kecMap.get(kKec);
    if (!kec) {
      kec = { key: kKota + '||' + kKec, label: '', bungkus: 0, omzet: 0, bungkus_banding: 0, omzet_banding: 0, mitra: [] };
      kota.kecMap.set(kKec, kec);
    }
    kec.label = ok ? labelLebihRapi(kec.label, m.kecamatan) : BELUM;
    tambah(kec, m);
    kec.mitra.push(m);
  }

  // Mitra dihitung per bulan: hanya yang benar-benar belanja di bulan itu.
  const aktif = (m, banding) => (banding ? (m.omzet_banding || 0) > 0 || (m.bungkus_banding || 0) > 0 : (m.omzet || 0) > 0 || (m.bungkus || 0) > 0);
  const hitungMitra = (list, banding) => new Set(list.filter(m => aktif(m, banding)).map(m => m.nama_customer)).size;
  const byOmzet = (a, b) => b.omzet - a.omzet || (b.omzet_banding || 0) - (a.omzet_banding || 0) || a.label.localeCompare(b.label);
  return [...kotaMap.values()]
    .map(k => {
      const kecamatan = [...k.kecMap.values()].map(c => ({
        ...c,
        jumlahMitra: new Set(c.mitra.map(m => m.nama_customer)).size,
        mitraIni: hitungMitra(c.mitra, false),
        mitraBanding: hitungMitra(c.mitra, true),
        mitra: c.mitra.slice().sort((a, b) => b.omzet - a.omzet || (b.omzet_banding || 0) - (a.omzet_banding || 0)),
      })).sort(byOmzet);
      const semua = kecamatan.flatMap(c => c.mitra);
      return {
        key: k.key, label: k.label, provinsi: k.provinsi, belum: k.belum,
        bungkus: k.bungkus, omzet: k.omzet, bungkus_banding: k.bungkus_banding, omzet_banding: k.omzet_banding,
        kecamatan,
        jumlahMitra: new Set(semua.map(m => m.nama_customer)).size,
        mitraIni: hitungMitra(semua, false),
        mitraBanding: hitungMitra(semua, true),
      };
    })
    // Grup "belum terpetakan" selalu paling bawah.
    .sort((a, b) => (a.belum - b.belum) || byOmzet(a, b));
}

// ---- Baca Excel "Data Master Stokis" -> hanya kolom wilayah ----
// Alamat lengkap, nama KTP, dan nomor HP sengaja tidak diambil.

function normHeader(h) {
  return String(h == null ? '' : h).toUpperCase().replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
}

const KOLOM = {
  nama: ['MASTER STOKIS', 'NAMA MASTER STOKIS'],
  desa: ['DESA KELURAHAN', 'DESA', 'KELURAHAN'],
  kecamatan: ['KECAMATAN'],
  kota: ['KOTA KABUPATEN', 'KOTA', 'KABUPATEN'],
  provinsi: ['PROVINSI'],
};

export function ambilKolomWilayah(aoa) {
  if (!Array.isArray(aoa)) return { rows: [], error: 'File kosong.' };
  // Header tidak selalu di baris pertama (Excel sumber punya 2 baris kosong di atas).
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const h = (aoa[i] || []).map(normHeader);
    const idx = {};
    for (const [k, keys] of Object.entries(KOLOM)) {
      idx[k] = -1;
      for (const key of keys) {
        const j = h.indexOf(key);
        if (j >= 0) { idx[k] = j; break; }
      }
    }
    if (idx.nama < 0 || idx.kecamatan < 0) continue;

    const ambil = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] == null ? '' : r[idx[k]]).trim() : '');
    const rows = [];
    const dihapus = [];
    for (const r of aoa.slice(i + 1)) {
      if (!Array.isArray(r)) continue;
      const nama = ambil(r, 'nama');
      if (!nama) continue;
      // Member yang sudah dihapus tidak dihitung sebagai mitra aktif; namanya
      // dikirim terpisah supaya ikut dibuang dari database.
      if (r.some(c => /member dihapus/i.test(String(c == null ? '' : c)))) {
        dihapus.push(nama);
        continue;
      }
      rows.push({
        nama,
        desa: ambil(r, 'desa'),
        kecamatan: ambil(r, 'kecamatan'),
        kota: ambil(r, 'kota'),
        provinsi: ambil(r, 'provinsi'),
      });
    }
    return { rows, dihapus, error: rows.length ? '' : 'Header ditemukan, tetapi tidak ada baris mitra di bawahnya.' };
  }
  return { rows: [], dihapus: [], error: 'Kolom "Master Stokis" dan "Kecamatan" tidak ditemukan di 20 baris pertama.' };
}

// ---- Filter & render ----

function getFiltered(list) {
  const cab = document.getElementById('omzet-kec-cabang').value;
  const kota = document.getElementById('omzet-kec-kota').value;
  // Untuk mitra tidak belanja, m.cabang = cabang belanja terakhirnya; yang
  // belum pernah belanja tidak punya cabang, jadi hanya tampil di "Semua Cabang".
  return (list || state.mitra).filter(m => {
    if (cab !== 'ALL' && m.cabang !== cab) return false;
    if (kota !== 'ALL') {
      const k = m.terpetakan && m.kecamatan ? kunciWilayah(m.kota) || '-' : BELUM;
      if (k !== kota) return false;
    }
    return true;
  });
}

function populateFilters() {
  const cabSel = document.getElementById('omzet-kec-cabang');
  const kotaSel = document.getElementById('omzet-kec-kota');
  const cabLama = cabSel.value;
  const kotaLama = kotaSel.value;

  const semua = state.mitra.concat(state.tidakBelanja, state.gabung);
  const cabang = [...new Set(semua.map(m => m.cabang).filter(Boolean))].sort();
  cabSel.innerHTML = '<option value="ALL">Semua Cabang</option>';
  cabang.forEach(c => cabSel.add(new Option(c, c)));
  if (cabang.includes(cabLama)) cabSel.value = cabLama;

  const kota = kelompokkan(semua).map(k => [k.key, k.label]).sort((a, b) => a[1].localeCompare(b[1]));
  kotaSel.innerHTML = '<option value="ALL">Semua Kota / Kab</option>';
  kota.forEach(([key, label]) => kotaSel.add(new Option(label, key)));
  if (kota.some(([key]) => key === kotaLama)) kotaSel.value = kotaLama;
}

function renderInfo(filtered) {
  const box = document.getElementById('omzet-kec-info');
  if (state.jumlahWilayah === 0) {
    box.innerHTML = '<i class="fas fa-triangle-exclamation text-amber-500 mr-2"></i>'
      + '<b>Data wilayah belum ada.</b> Klik <b>Update Data Wilayah</b> lalu pilih file Excel "Data Master Stokis" '
      + '(yang berisi kolom Master Stokis, Kecamatan, Kota / Kabupaten).';
    box.classList.remove('hidden');
    return;
  }
  const totalOmzet = filtered.reduce((a, m) => a + m.omzet, 0);
  const ok = filtered.filter(m => m.terpetakan);
  const okOmzet = ok.reduce((a, m) => a + m.omzet, 0);
  const namaBelum = [...new Set(filtered.filter(m => !m.terpetakan).map(m => m.nama_customer))];
  let html = `<b>${num(new Set(ok.map(m => m.nama_customer)).size)}</b> dari <b>${num(new Set(filtered.map(m => m.nama_customer)).size)}</b> mitra MST/MSI terpetakan ke kecamatan `
    + `(<b>${persen(okOmzet, totalOmzet)}</b> omzet). Data wilayah tersimpan: ${num(state.jumlahWilayah)} mitra.`;
  if (namaBelum.length) {
    html += `<br><span class="text-amber-700">Belum terpetakan: ${namaBelum.slice(0, 10).map(esc).join(', ')}${namaBelum.length > 10 ? ', …' : ''}</span>`;
  }
  box.innerHTML = html;
  box.classList.remove('hidden');
}

function badge(t) {
  const cls = t === 'MST' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700';
  return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${cls}">${esc(t)}</span>`;
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function tanggalTeks(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${Number(d)} ${BULAN_PENDEK[Number(m) - 1] || m} ${y}`;
}

function bulanPendek(ym) {
  const [y, m] = String(ym || '').split('-');
  return `${BULAN_PENDEK[Number(m) - 1] || m} ${y}`;
}

// Selisih, persen, dan tren bulan ini dibanding bulan pembanding.
export function hitungPerubahan(ini, banding) {
  const a = Number(ini) || 0;
  const b = Number(banding) || 0;
  const selisih = a - b;
  if (b === 0 && a > 0) return { selisih, persen: null, tren: 'baru' };
  if (a === 0 && b > 0) return { selisih, persen: -100, tren: 'berhenti' };
  if (a === 0 && b === 0) return { selisih: 0, persen: null, tren: 'tetap' };
  return { selisih, persen: selisih / b * 100, tren: selisih > 0 ? 'naik' : selisih < 0 ? 'turun' : 'tetap' };
}

const TREN = {
  baru:     { simbol: '▲', warna: 'text-emerald-600', label: 'Baru' },
  naik:     { simbol: '▲', warna: 'text-emerald-600', label: 'Naik' },
  turun:    { simbol: '▼', warna: 'text-red-600', label: 'Turun' },
  berhenti: { simbol: '▼', warna: 'text-red-600', label: 'Berhenti' },
  tetap:    { simbol: '=', warna: 'text-slate-400', label: 'Sama' },
};

function teksPersen(p) {
  if (p.tren === 'baru') return 'Baru';
  if (p.persen === null) return '-';
  const v = Math.round(p.persen * 10) / 10;
  return (v > 0 ? '+' : '') + v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

// Sel Selisih | % | Tren untuk satu baris perbandingan.
function selPerubahan(ini, banding, kecil) {
  const p = hitungPerubahan(ini, banding);
  const t = TREN[p.tren];
  const py = kecil ? 'py-1.5' : 'py-2';
  return `<td class="px-4 ${py} text-right font-mono ${t.warna}">${p.selisih > 0 ? '+' : ''}${num(p.selisih)}</td>
    <td class="px-4 ${py} text-right font-mono ${t.warna}">${teksPersen(p)}</td>
    <td class="px-4 ${py} text-center font-bold ${t.warna}" title="${t.label}">${t.simbol}<span class="sr-only">${t.label}</span></td>`;
}

// Sel Bungkus bulan pembanding | Bungkus bulan ini | Selisih bungkus.
function selBungkus(ini, banding, opsi = {}) {
  const py = opsi.kecil ? 'py-1.5' : 'py-2';
  const p = hitungPerubahan(ini, banding);
  let warna = TREN[p.tren].warna;
  if (opsi.gelap) warna = warna.replace('emerald-600', 'emerald-300').replace('red-600', 'red-300').replace('slate-400', 'slate-300');
  const kiri = opsi.gelap ? '' : 'text-slate-500';
  const kanan = opsi.gelap ? '' : 'text-slate-700';
  return `<td class="px-4 ${py} text-right font-mono ${kiri}">${num(banding)}</td>
    <td class="px-4 ${py} text-right font-mono ${kanan}">${num(ini)}</td>
    <td class="px-4 ${py} text-right font-mono ${warna}">${p.selisih > 0 ? '+' : ''}${num(p.selisih)}</td>`;
}

function renderBanding() {
  const thead = document.getElementById('omzet-kec-thead');
  const tbody = document.getElementById('omzet-kec-tbody');
  const tfoot = document.getElementById('omzet-kec-tfoot');
  const bB = bulanPendek(state.banding);
  const bI = bulanPendek(state.bulan);

  thead.innerHTML = `<tr>
    <th class="px-4 py-3 text-left whitespace-nowrap">Kecamatan</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Mitra ${esc(bB)} → ${esc(bI)}</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Bks ${esc(bB)}</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Bks ${esc(bI)}</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Selisih Bks</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Omzet ${esc(bB)}</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Omzet ${esc(bI)}</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Selisih (Rp)</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">%</th>
    <th class="px-4 py-3 text-center whitespace-nowrap">Tren</th></tr>`;

  const list = getFiltered(state.gabung);
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-500">Tidak ada penjualan MST/MSI di kedua bulan.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  const kota = kelompokkan(list);
  let html = '';
  for (const k of kota) {
    html += `<tr class="${k.belum ? 'bg-amber-700' : 'bg-slate-800'} text-white font-bold">
      <td class="px-4 py-2 uppercase tracking-wider">${esc(k.label)}</td>
      <td class="px-4 py-2 text-right font-mono">${num(k.mitraBanding)} → ${num(k.mitraIni)}</td>
      ${selBungkus(k.bungkus, k.bungkus_banding, { gelap: true })}
      <td class="px-4 py-2 text-right font-mono">${num(k.omzet_banding)}</td>
      <td class="px-4 py-2 text-right font-mono">${num(k.omzet)}</td>
      ${selPerubahan(k.omzet, k.omzet_banding).replace(/text-emerald-600/g, 'text-emerald-300').replace(/text-red-600/g, 'text-red-300').replace(/text-slate-400/g, 'text-slate-300')}</tr>`;

    for (const c of k.kecamatan) {
      const buka = state.terbuka.has(c.key);
      html += `<tr data-kec="${esc(c.key)}" class="hover:bg-slate-50 cursor-pointer transition-colors">
        <td class="px-4 py-2 font-semibold text-slate-700 whitespace-nowrap">
          <i class="fas fa-chevron-${buka ? 'down' : 'right'} text-[10px] text-slate-400 mr-2 w-3"></i>${esc(c.label)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-600">${num(c.mitraBanding)} → ${num(c.mitraIni)}</td>
        ${selBungkus(c.bungkus, c.bungkus_banding)}
        <td class="px-4 py-2 text-right font-mono text-slate-500">${num(c.omzet_banding)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold text-slate-800">${num(c.omzet)}</td>
        ${selPerubahan(c.omzet, c.omzet_banding)}</tr>`;
      if (buka) {
        for (const m of c.mitra) {
          html += `<tr class="bg-slate-50 text-xs">
            <td class="pl-12 pr-4 py-1.5 text-slate-600 whitespace-nowrap">${badge(m.tipe)} <span class="ml-1">${esc(m.nama_customer)}</span> <span class="text-slate-400">· ${esc(m.cabang)}</span></td>
            <td></td>
            ${selBungkus(m.bungkus, m.bungkus_banding, { kecil: true })}
            <td class="px-4 py-1.5 text-right font-mono text-slate-500">${num(m.omzet_banding)}</td>
            <td class="px-4 py-1.5 text-right font-mono text-slate-700">${num(m.omzet)}</td>
            ${selPerubahan(m.omzet, m.omzet_banding, true)}</tr>`;
        }
      }
    }
  }
  tbody.innerHTML = html;

  tbody.querySelectorAll('tr[data-kec]').forEach(tr => {
    tr.addEventListener('click', () => {
      const key = tr.getAttribute('data-kec');
      if (state.terbuka.has(key)) state.terbuka.delete(key);
      else state.terbuka.add(key);
      renderOmzet();
    });
  });

  const gI = kota.reduce((a, k) => a + k.omzet, 0);
  const gB = kota.reduce((a, k) => a + k.omzet_banding, 0);
  const bksI = kota.reduce((a, k) => a + k.bungkus, 0);
  const bksB = kota.reduce((a, k) => a + k.bungkus_banding, 0);
  const aktif = (m, b) => (b ? m.omzet_banding || m.bungkus_banding : m.omzet || m.bungkus) > 0;
  const mI = new Set(list.filter(m => aktif(m, false)).map(m => m.nama_customer)).size;
  const mB = new Set(list.filter(m => aktif(m, true)).map(m => m.nama_customer)).size;
  tfoot.innerHTML = `<tr>
    <td class="px-4 py-3 text-right uppercase tracking-wider">GRAND TOTAL</td>
    <td class="px-4 py-3 text-right font-mono">${num(mB)} → ${num(mI)}</td>
    ${selBungkus(bksI, bksB).replace(/py-2/g, 'py-3')}
    <td class="px-4 py-3 text-right font-mono">${num(gB)}</td>
    <td class="px-4 py-3 text-right font-mono">${num(gI)}</td>
    ${selPerubahan(gI, gB)}</tr>`;
}

function renderTidakBelanja() {
  const list = getFiltered(state.tidakBelanja);
  const judul = document.getElementById('omzet-kec-tb-judul');
  const body = document.getElementById('omzet-kec-tb-body');
  const ikon = document.getElementById('omzet-kec-tb-ikon');
  const tbody = document.getElementById('omzet-kec-tb-tbody');

  const pernah = list.filter(m => m.terakhir_belanja).length;
  judul.innerHTML = `MST / MSI Tidak Belanja ${esc(bulanTeks(state.bulan))}`
    + `<span class="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">${num(list.length)} mitra</span>`
    + `<span class="ml-2 text-xs font-normal text-slate-500">${num(pernah)} pernah belanja dalam 6 bulan terakhir, ${num(list.length - pernah)} tidak sama sekali</span>`;
  body.classList.toggle('hidden', !state.tbTerbuka);
  ikon.className = `fas fa-chevron-${state.tbTerbuka ? 'up' : 'down'} text-slate-400`;
  if (!state.tbTerbuka) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Semua MST/MSI di data wilayah belanja di bulan ini.</td></tr>';
    return;
  }

  let html = '';
  for (const k of kelompokkan(list)) {
    html += `<tr class="${k.belum ? 'bg-amber-700' : 'bg-slate-800'} text-white font-bold">
      <td colspan="5" class="px-4 py-2 uppercase tracking-wider">${esc(k.label)} <span class="font-normal normal-case text-slate-300 text-xs">· ${num(k.jumlahMitra)} mitra</span></td></tr>`;
    for (const c of k.kecamatan) {
      html += `<tr class="bg-slate-100"><td colspan="5" class="px-4 py-1.5 font-semibold text-slate-700">${esc(c.label)} <span class="font-normal text-slate-500 text-xs">· ${num(c.jumlahMitra)} mitra</span></td></tr>`;
      // Yang terakhir belanjanya paling baru di atas: paling mudah diajak belanja lagi.
      const urut = c.mitra.slice().sort((a, b) => (b.terakhir_belanja || '').localeCompare(a.terakhir_belanja || '')
        || String(a.nama_customer).localeCompare(String(b.nama_customer), undefined, { numeric: true }));
      for (const m of urut) {
        // Hanya nomor pertama (sebelum "/") dan hanya digit yang masuk ke URL wa.me.
        const wa = String(m.kontak || '').split('/')[0].replace(/\D/g, '').replace(/^0/, '62');
        const kontak = m.kontak
          ? (wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener" class="text-emerald-600 hover:underline font-mono">${esc(m.kontak)}</a>` : esc(m.kontak))
          : '<span class="text-slate-300">—</span>';
        html += `<tr class="hover:bg-slate-50">
          <td class="pl-8 pr-4 py-1.5 whitespace-nowrap">${badge(m.tipe)} <span class="ml-1 text-slate-700">${esc(m.nama_customer)}</span></td>
          <td class="px-4 py-1.5 text-slate-600 whitespace-nowrap">${m.pemilik ? esc(m.pemilik) : '<span class="text-slate-300">—</span>'}</td>
          <td class="px-4 py-1.5 whitespace-nowrap">${kontak}</td>
          <td class="px-4 py-1.5 whitespace-nowrap ${m.terakhir_belanja ? 'text-slate-700' : 'text-slate-400'}">${m.terakhir_belanja ? esc(tanggalTeks(m.terakhir_belanja)) : 'Tidak ada (6 bln)'}</td>
          <td class="px-4 py-1.5 text-slate-500 whitespace-nowrap">${esc(m.cabang || '—')}</td></tr>`;
      }
    }
  }
  tbody.innerHTML = html;
}

function renderOmzet() {
  const thead = document.getElementById('omzet-kec-thead');
  const tbody = document.getElementById('omzet-kec-tbody');
  const tfoot = document.getElementById('omzet-kec-tfoot');

  thead.innerHTML = `<tr>
    <th class="px-4 py-3 text-left whitespace-nowrap">Kecamatan</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Jumlah Mitra</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Total Bungkus</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Omzet (Rp)</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">% Omzet</th></tr>`;

  const filtered = getFiltered();
  renderInfo(filtered);
  renderTidakBelanja();
  if (state.modeBanding) {
    renderBanding();
    return;
  }
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Tidak ada penjualan MST/MSI pada bulan ini.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  const kota = kelompokkan(filtered);
  const grandOmzet = kota.reduce((a, k) => a + k.omzet, 0);
  const grandBungkus = kota.reduce((a, k) => a + k.bungkus, 0);
  const grandMitra = new Set(filtered.map(m => m.nama_customer)).size;

  let html = '';
  for (const k of kota) {
    html += `<tr class="${k.belum ? 'bg-amber-700' : 'bg-slate-800'} text-white font-bold">
      <td class="px-4 py-2 uppercase tracking-wider">${esc(k.label)}${k.provinsi ? ` <span class="font-normal normal-case text-slate-300 text-xs">· ${esc(k.provinsi)}</span>` : ''}</td>
      <td class="px-4 py-2 text-right font-mono">${num(k.jumlahMitra)}</td>
      <td class="px-4 py-2 text-right font-mono">${num(k.bungkus)}</td>
      <td class="px-4 py-2 text-right font-mono">${num(k.omzet)}</td>
      <td class="px-4 py-2 text-right font-mono">${persen(k.omzet, grandOmzet)}</td></tr>`;

    for (const c of k.kecamatan) {
      const buka = state.terbuka.has(c.key);
      html += `<tr data-kec="${esc(c.key)}" class="hover:bg-slate-50 cursor-pointer transition-colors">
        <td class="px-4 py-2 font-semibold text-slate-700 whitespace-nowrap">
          <i class="fas fa-chevron-${buka ? 'down' : 'right'} text-[10px] text-slate-400 mr-2 w-3"></i>${esc(c.label)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-600">${num(c.jumlahMitra)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-700">${num(c.bungkus)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold text-emerald-600">${num(c.omzet)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-500">${persen(c.omzet, grandOmzet)}</td></tr>`;
      if (buka) {
        for (const m of c.mitra) {
          html += `<tr class="bg-slate-50 text-xs">
            <td class="pl-12 pr-4 py-1.5 text-slate-600 whitespace-nowrap">${badge(m.tipe)} <span class="ml-1">${esc(m.nama_customer)}</span> <span class="text-slate-400">· ${esc(m.cabang)}</span></td>
            <td></td>
            <td class="px-4 py-1.5 text-right font-mono text-slate-600">${num(m.bungkus)}</td>
            <td class="px-4 py-1.5 text-right font-mono text-slate-600">${num(m.omzet)}</td>
            <td class="px-4 py-1.5 text-right font-mono text-slate-400">${persen(m.omzet, grandOmzet)}</td></tr>`;
        }
      }
    }
  }
  tbody.innerHTML = html;

  tbody.querySelectorAll('tr[data-kec]').forEach(tr => {
    tr.addEventListener('click', () => {
      const key = tr.getAttribute('data-kec');
      if (state.terbuka.has(key)) state.terbuka.delete(key);
      else state.terbuka.add(key);
      renderOmzet();
    });
  });

  tfoot.innerHTML = `<tr>
    <td class="px-4 py-3 text-right uppercase tracking-wider">GRAND TOTAL</td>
    <td class="px-4 py-3 text-right font-mono">${num(grandMitra)}</td>
    <td class="px-4 py-3 text-right font-mono">${num(grandBungkus)}</td>
    <td class="px-4 py-3 text-right font-mono text-emerald-700">${num(grandOmzet)}</td>
    <td class="px-4 py-3 text-right font-mono">100%</td></tr>`;
}

export function loadOmzetKecamatan() {
  const bulan = document.getElementById('omzet-kec-bulan').value;
  const banding = document.getElementById('omzet-kec-banding').value;
  const bandingAktif = document.getElementById('omzet-kec-banding-aktif').checked && banding && banding !== bulan;
  const loader = document.getElementById('omzet-kec-loader');
  const content = document.getElementById('omzet-kec-content');
  loader.classList.remove('hidden');
  loader.classList.add('flex');
  content.classList.add('hidden');

  // Kedua bulan diambil bersamaan; tidak ada perubahan di backend.
  return Promise.all([
    callApi('getOmzetKecamatan', bulan),
    bandingAktif ? callApi('getOmzetKecamatan', banding) : Promise.resolve(null),
  ])
    .then(([res, resB]) => {
      const d = res.data || {};
      state.bulan = d.bulan || bulan;
      state.mitra = d.mitra || [];
      state.modeBanding = !!resB;
      state.banding = resB ? ((resB.data && resB.data.bulan) || banding) : '';
      state.gabung = resB ? gabungBulan(state.mitra, (resB.data && resB.data.mitra) || []) : [];
      state.tidakBelanja = d.tidak_belanja || [];
      state.jumlahWilayah = d.jumlah_wilayah || 0;
      state.terbuka = new Set();
      populateFilters();
      renderOmzet();
    })
    .catch(err => alert('Gagal memuat omzet per kecamatan: ' + err.message))
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    });
}

function uploadWilayah(file) {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    let hasil;
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      hasil = ambilKolomWilayah(aoa);
    } catch (err) {
      alert('File tidak bisa dibaca: ' + err.message);
      return;
    }
    if (hasil.error) {
      alert(hasil.error);
      return;
    }
    const tanpaKec = hasil.rows.filter(r => !r.kecamatan).length;
    const dihapus = hasil.dihapus || [];
    const pesan = `Ditemukan ${hasil.rows.length} Master Stokis` + (tanpaKec ? ` (${tanpaKec} tanpa kecamatan)` : '')
      + (dihapus.length ? `, dan ${dihapus.length} "Member dihapus" yang akan dikeluarkan dari data wilayah` : '')
      + '.\n\nHanya nama, desa, kecamatan, kota, dan provinsi yang disimpan. Lanjutkan?';
    if (!confirm(pesan)) return;

    callApi('simpanWilayahMitra', hasil.rows, 'MASTER', dihapus)
      .then(res => {
        showToast(`Data wilayah tersimpan: ${(res.data && res.data.saved) || hasil.rows.length} mitra`, 'success');
        return loadOmzetKecamatan();
      })
      .catch(err => alert('Gagal menyimpan data wilayah: ' + err.message));
  };
  reader.readAsArrayBuffer(file);
}

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function bulanTeks(ym) {
  const [yr, mo] = String(ym || '').split('-');
  return `${BULAN_NAMES[Number(mo) - 1] || mo} ${yr}`;
}

// Sheet 1 & 2 untuk mode perbandingan dua bulan.
function buatSheetBanding(judul, headerStyle) {
  const list = getFiltered(state.gabung);
  const kota = kelompokkan(list);
  const bB = bulanPendek(state.banding).toUpperCase();
  const bI = bulanPendek(state.bulan).toUpperCase();
  // % disimpan sebagai angka supaya bisa diurutkan di Excel; "BARU" kalau bulan pembanding 0.
  const kolomUbah = (ini, banding) => {
    const p = hitungPerubahan(ini, banding);
    return [p.selisih, p.tren === 'baru' ? 'BARU' : p.persen === null ? '' : Math.round(p.persen * 10) / 10, TREN[p.tren].label.toUpperCase()];
  };

  const KOLOM = 15;
  const rows = judul.map(r => r.slice());
  rows.push(['KOTA / KABUPATEN', 'KECAMATAN', 'NAMA MST / MSI', 'TIPE', 'CABANG',
    `MITRA ${bB}`, `MITRA ${bI}`, `BUNGKUS ${bB}`, `BUNGKUS ${bI}`, 'SELISIH BUNGKUS', `OMZET ${bB} (Rp)`, `OMZET ${bI} (Rp)`, 'SELISIH (Rp)', '% PERUBAHAN', 'TREN']);
  const kecIdx = [];
  const subIdx = [];
  for (const k of kota) {
    for (const c of k.kecamatan) {
      kecIdx.push(rows.length);
      rows.push([k.label, c.label, '', '', '', c.mitraBanding, c.mitraIni, c.bungkus_banding, c.bungkus, c.bungkus - c.bungkus_banding, c.omzet_banding, c.omzet, ...kolomUbah(c.omzet, c.omzet_banding)]);
      for (const m of c.mitra) {
        rows.push(['', '', m.nama_customer, m.tipe, m.cabang, '', '', m.bungkus_banding, m.bungkus, m.bungkus - m.bungkus_banding, m.omzet_banding, m.omzet, ...kolomUbah(m.omzet, m.omzet_banding)]);
      }
    }
    subIdx.push(rows.length);
    rows.push([`SUBTOTAL ${k.label}`, '', '', '', '', k.mitraBanding, k.mitraIni, k.bungkus_banding, k.bungkus, k.bungkus - k.bungkus_banding, k.omzet_banding, k.omzet, ...kolomUbah(k.omzet, k.omzet_banding)]);
    rows.push([]);
  }
  const gI = kota.reduce((a, k) => a + k.omzet, 0);
  const gB = kota.reduce((a, k) => a + k.omzet_banding, 0);
  const aktif = (m, b) => (b ? m.omzet_banding || m.bungkus_banding : m.omzet || m.bungkus) > 0;
  const grandIdx = rows.length;
  rows.push(['GRAND TOTAL', '', '', '', '',
    new Set(list.filter(m => aktif(m, true)).map(m => m.nama_customer)).size,
    new Set(list.filter(m => aktif(m, false)).map(m => m.nama_customer)).size,
    kota.reduce((a, k) => a + k.bungkus_banding, 0), kota.reduce((a, k) => a + k.bungkus, 0),
    kota.reduce((a, k) => a + k.bungkus - k.bungkus_banding, 0),
    gB, gI, ...kolomUbah(gI, gB)]);

  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  formatAngka(ws1);
  for (let r = 6; r < rows.length; r++) {
    const ref = XLSX.utils.encode_cell({ c: 13, r });
    if (ws1[ref] && typeof ws1[ref].v === 'number') ws1[ref].z = '+0.0"%";-0.0"%";0.0"%"';
  }
  gayaBaris(ws1, 5, KOLOM, headerStyle);
  kecIdx.forEach(r => gayaBaris(ws1, r, KOLOM, { font: { bold: true }, fill: { fgColor: { rgb: 'F1F5F9' } } }));
  subIdx.forEach(r => gayaBaris(ws1, r, KOLOM, { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } }));
  gayaBaris(ws1, grandIdx, KOLOM, { font: { bold: true }, fill: { fgColor: { rgb: 'CBD5E1' } } });
  rapikanSheet(ws1, rows);

  const det = judul.map(r => r.slice());
  det.push(['KOTA / KABUPATEN', 'KECAMATAN', 'NAMA MST / MSI', 'TIPE', 'CABANG',
    `BUNGKUS ${bB}`, `BUNGKUS ${bI}`, 'SELISIH BUNGKUS', `OMZET ${bB} (Rp)`, `OMZET ${bI} (Rp)`, 'SELISIH (Rp)', '% PERUBAHAN', 'TREN']);
  for (const k of kota) {
    for (const c of k.kecamatan) {
      for (const m of c.mitra) {
        det.push([k.label, c.label, m.nama_customer, m.tipe, m.cabang, m.bungkus_banding, m.bungkus, m.bungkus - m.bungkus_banding, m.omzet_banding, m.omzet, ...kolomUbah(m.omzet, m.omzet_banding)]);
      }
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(det);
  formatAngka(ws2);
  for (let r = 6; r < det.length; r++) {
    const ref = XLSX.utils.encode_cell({ c: 11, r });
    if (ws2[ref] && typeof ws2[ref].v === 'number') ws2[ref].z = '+0.0"%";-0.0"%";0.0"%"';
  }
  gayaBaris(ws2, 5, 13, headerStyle);
  rapikanSheet(ws2, det, { filter: true });
  return [ws1, ws2];
}

export function exportOmzetKecamatan() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }
  const filtered = getFiltered();
  if (filtered.length === 0 && !(state.modeBanding && getFiltered(state.gabung).length)) {
    alert('Tidak ada data untuk diexport.');
    return;
  }
  const cabSel = document.getElementById('omzet-kec-cabang');
  const kotaSel = document.getElementById('omzet-kec-kota');
  const cabLabel = cabSel.value === 'ALL' ? 'SEMUA CABANG' : cabSel.value;
  const kotaLabel = kotaSel.value === 'ALL' ? 'SEMUA KOTA / KAB' : kotaSel.options[kotaSel.selectedIndex].text;

  const kota = kelompokkan(filtered);
  const grandOmzet = kota.reduce((a, k) => a + k.omzet, 0);
  const grandBungkus = kota.reduce((a, k) => a + k.bungkus, 0);
  const pct = (a) => (grandOmzet > 0 ? Math.round(a / grandOmzet * 1000) / 10 : 0);
  const judul = [
    ['PT TRIDAYA SINERGI INDONESIA'],
    ['OMZET PER KECAMATAN — MASTER STOKIS & MSI'],
    [`${cabLabel} · ${kotaLabel}`],
    [state.modeBanding
      ? `PERBANDINGAN ${bulanTeks(state.banding).toUpperCase()} VS ${bulanTeks(state.bulan).toUpperCase()}`
      : `PERIODE ${bulanTeks(state.bulan).toUpperCase()}`],
    [],
  ];
  const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } };

  let ws1, ws2;
  if (state.modeBanding) {
    [ws1, ws2] = buatSheetBanding(judul, headerStyle);
  } else {
  // Sheet 1: per kecamatan, dengan nama MST / MSI di bawah tiap kecamatan
  // (sama seperti saat kecamatan diklik di layar).
  const KOLOM1 = 9;
  const rows = judul.map(r => r.slice());
  rows.push(['KOTA / KABUPATEN', 'KECAMATAN', 'NAMA MST / MSI', 'TIPE', 'CABANG', 'JUMLAH MITRA', 'TOTAL BUNGKUS', 'OMZET (Rp)', '% OMZET']);
  const kecIdx = [];
  const subtotalIdx = [];
  for (const k of kota) {
    for (const c of k.kecamatan) {
      kecIdx.push(rows.length);
      rows.push([k.label, c.label, '', '', '', c.jumlahMitra, c.bungkus, c.omzet, pct(c.omzet)]);
      for (const m of c.mitra) {
        rows.push(['', '', m.nama_customer, m.tipe, m.cabang, '', m.bungkus, m.omzet, pct(m.omzet)]);
      }
    }
    subtotalIdx.push(rows.length);
    rows.push([`SUBTOTAL ${k.label}`, '', '', '', '', k.jumlahMitra, k.bungkus, k.omzet, pct(k.omzet)]);
    rows.push([]);
  }
  const grandIdx = rows.length;
  rows.push(['GRAND TOTAL', '', '', '', '', new Set(filtered.map(m => m.nama_customer)).size, grandBungkus, grandOmzet, 100]);

  ws1 = XLSX.utils.aoa_to_sheet(rows);
  formatAngka(ws1);
  for (let r = 6; r < rows.length; r++) {
    const ref = XLSX.utils.encode_cell({ c: 8, r });
    if (ws1[ref] && typeof ws1[ref].v === 'number') ws1[ref].z = '0.0"%"';
  }
  gayaBaris(ws1, 5, KOLOM1, headerStyle);
  kecIdx.forEach(r => gayaBaris(ws1, r, KOLOM1, { font: { bold: true }, fill: { fgColor: { rgb: 'F1F5F9' } } }));
  subtotalIdx.forEach(r => gayaBaris(ws1, r, KOLOM1, { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } }));
  gayaBaris(ws1, grandIdx, KOLOM1, { font: { bold: true }, fill: { fgColor: { rgb: 'CBD5E1' } } });
  rapikanSheet(ws1, rows);

  // Sheet 2: detail per mitra
  const det = judul.map(r => r.slice());
  det.push(['KOTA / KABUPATEN', 'KECAMATAN', 'NAMA MITRA', 'TIPE', 'CABANG', 'TOTAL BUNGKUS', 'OMZET (Rp)']);
  for (const k of kota) {
    for (const c of k.kecamatan) {
      for (const m of c.mitra) det.push([k.label, c.label, m.nama_customer, m.tipe, m.cabang, m.bungkus, m.omzet]);
    }
  }
  ws2 = XLSX.utils.aoa_to_sheet(det);
  formatAngka(ws2);
  gayaBaris(ws2, 5, 7, headerStyle);
  rapikanSheet(ws2, det, { filter: true });
  }

  // Sheet 3: MST / MSI yang tidak belanja di bulan ini
  const tb = judul.map(r => r.slice());
  tb[1] = [`MST / MSI TIDAK BELANJA ${bulanTeks(state.bulan).toUpperCase()}`];
  tb.push(['KOTA / KABUPATEN', 'KECAMATAN', 'NAMA MST / MSI', 'TIPE', 'PEMILIK', 'HP / TELEPON', 'TERAKHIR BELANJA (6 BLN)', 'CABANG TERAKHIR']);
  for (const k of kelompokkan(getFiltered(state.tidakBelanja))) {
    for (const c of k.kecamatan) {
      const urut = c.mitra.slice().sort((a, b) => String(a.nama_customer).localeCompare(String(b.nama_customer), undefined, { numeric: true }));
      for (const m of urut) {
        tb.push([k.label, c.label, m.nama_customer, m.tipe, m.pemilik || '', m.kontak || '',
          m.terakhir_belanja ? tanggalTeks(m.terakhir_belanja) : 'Tidak ada', m.cabang || '']);
      }
    }
  }
  const ws3 = XLSX.utils.aoa_to_sheet(tb);
  gayaBaris(ws3, 5, 8, headerStyle);
  rapikanSheet(ws3, tb, { filter: true });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Per Kecamatan');
  XLSX.utils.book_append_sheet(wb, ws2, 'Detail Mitra');
  XLSX.utils.book_append_sheet(wb, ws3, 'Tidak Belanja');
  const periode = state.modeBanding ? `${bulanTeks(state.banding)} VS ${bulanTeks(state.bulan)}` : bulanTeks(state.bulan);
  const fileName = `Omzet per Kecamatan ${periode}${cabSel.value === 'ALL' ? '' : ' ' + cabSel.value}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('File Excel berhasil diunduh: ' + fileName, 'success');
}

let sudahInit = false;

export function initOmzetKecamatan() {
  // Router memanggil ini setiap menu dibuka; listener cukup dipasang sekali.
  if (sudahInit) return;
  sudahInit = true;

  const bulan = document.getElementById('omzet-kec-bulan');
  const now = new Date();
  // Default bulan lalu: bulan berjalan biasanya belum lengkap.
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  bulan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Default membandingkan dengan bulan sebelumnya; ikut bergeser kalau Bulan diganti.
  const banding = document.getElementById('omzet-kec-banding');
  const bandingAktif = document.getElementById('omzet-kec-banding-aktif');
  const setBandingSebelum = () => {
    const [y, m] = bulan.value.split('-').map(Number);
    if (!y || !m) return;
    const p = new Date(y, m - 2, 1);
    banding.value = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
  };
  setBandingSebelum();
  bulan.addEventListener('change', setBandingSebelum);
  const sinkronBanding = () => { banding.disabled = !bandingAktif.checked; };
  bandingAktif.addEventListener('change', sinkronBanding);
  sinkronBanding();

  document.getElementById('btn-omzet-kec-terapkan').addEventListener('click', loadOmzetKecamatan);
  document.getElementById('omzet-kec-cabang').addEventListener('change', () => { state.terbuka = new Set(); renderOmzet(); });
  document.getElementById('omzet-kec-kota').addEventListener('change', () => { state.terbuka = new Set(); renderOmzet(); });
  document.getElementById('btn-omzet-kec-export').addEventListener('click', exportOmzetKecamatan);
  document.getElementById('btn-omzet-kec-tb-toggle').addEventListener('click', () => {
    state.tbTerbuka = !state.tbTerbuka;
    renderTidakBelanja();
  });

  const fileInput = document.getElementById('omzet-kec-file');
  document.getElementById('btn-omzet-kec-upload').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = ''; // supaya file yang sama bisa dipilih lagi
    if (f) uploadWilayah(f);
  });

  loadOmzetKecamatan();
}
