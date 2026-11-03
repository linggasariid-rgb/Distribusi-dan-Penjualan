import { callApi } from '../../services/api.js';
import { showToast } from '../../ui/toast.js';
import { gayaBaris, formatAngka, rapikanSheet, gayaHeader } from '../../utils/excelRapi.js';

// Biaya vs Omzet -- biaya kas kecil + e-toll per cabang dibanding omzet.
// WHO: biaya, omzet, % biaya/omzet, biaya per bungkus.
// WHP (gudang): hanya rekap pengeluaran, tanpa omzet.

// Jenis transaksi kas kecil yang BUKAN biaya: perpindahan uang (pengisian kas,
// pengembalian sisa kas, tukar pecahan).
const BUKAN_BIAYA = new Set(['', '0', 'SETORAN TUNAI KAS KECIL', 'CLOSING KAS', 'TUKAR DENOM', 'MASUK KAS KECIL']);

// Cabang yang biaya BBM & tol-nya dibayar pakai kartu e-toll di luar kas kecil.
// Cabang lain mengisi saldo e-toll dari kas kecil ("Biaya Pengisian ETOLL"), jadi
// kalau e-toll mereka ikut diambil, biayanya terhitung dua kali.
export const ETOLL_CABANG = ['WHP BANDUNG', 'BANDUNG', 'CIBADUYUT'];

let state = {
  bulan: '',
  banding: '',
  modeBanding: false,
  data: null,   // { bulan, biaya: [...], omzet: {CABANG: {omzet, bungkus}}, sumber_ada }
  dataB: null,  // bulan pembanding
  terbuka: new Set(),
};

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const num = n => Math.round(Number(n || 0)).toLocaleString('id-ID');
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const bulanTeks = ym => { const [y, m] = String(ym || '').split('-'); return `${BULAN[Number(m) - 1] || m} ${y}`; };
const bulanPendek = ym => { const [y, m] = String(ym || '').split('-'); return `${BULAN_PENDEK[Number(m) - 1] || m} ${y}`; };
const pad = n => String(n).padStart(2, '0');

// Sama dengan normCabang() di worker/src/routes/biaya-cabang.js.
export function normCabang(w) {
  return String(w == null ? '' : w).replace(/\s+/g, ' ').trim().toUpperCase()
    .replace(/\([^)]*\)/g, '').replace(/^WHO\s+/, '').replace(/\s+/g, ' ').trim();
}
const isWHP = c => /^WHP\b/.test(c);

function normHeader(h) {
  return String(h == null ? '' : h).replace(/\s+/g, ' ').trim().toUpperCase();
}

// Tanggal Excel (serial angka) atau teks "dd/mm/yyyy" -> "yyyy-mm-dd".
export function keTanggal(v) {
  if (typeof v === 'number' && v > 0) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : '';
  }
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

const angka = v => {
  if (typeof v === 'number') return v;
  const n = Number(String(v == null ? '' : v).replace(/[^\d,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// ---- Baca file "Rekap Kas Kecil" ----
export function bacaKasKecil(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const h = (aoa[i] || []).map(normHeader);
    const col = k => h.indexOf(k);
    const idx = {
      warehouse: col('WAREHOUSE'), tanggal: col('TANGGAL'), noKas: col('NO. KAS KELUAR'),
      noRef: col('NO. REFERENSI'), code: col('CODE'), jenis: col('JENIS TRANSAKSI'),
      keluar: col('KAS KELUAR'), masuk: col('KAS MASUK'),
    };
    if (idx.warehouse < 0 || idx.jenis < 0 || idx.keluar < 0) continue;
    // Ada dua kolom "Nama" (penanggung jawab & pendamping).
    const namaIdx = h.map((x, j) => (x === 'NAMA' ? j : -1)).filter(j => j >= 0);

    const rows = [];
    let lewatNonBiaya = 0;
    let lewatTanpaTanggal = 0;
    for (const r of aoa.slice(i + 1)) {
      if (!Array.isArray(r) || !String(r[idx.warehouse] || '').trim()) continue;
      const noKas = String(r[idx.noKas] == null ? '' : r[idx.noKas]).trim();
      const jenis = String(r[idx.jenis] == null ? '' : r[idx.jenis]).replace(/\s+/g, ' ').trim();
      if (!/^KK-/i.test(noKas) || BUKAN_BIAYA.has(jenis.toUpperCase())) { lewatNonBiaya++; continue; }
      const tanggal = keTanggal(r[idx.tanggal]);
      if (!tanggal) { lewatTanpaTanggal++; continue; }
      rows.push({
        periode: tanggal.slice(0, 7),
        cabang: normCabang(r[idx.warehouse]),
        tanggal,
        no_kas: noKas,
        no_ref: idx.noRef >= 0 ? String(r[idx.noRef] || '').trim() : '',
        nama: namaIdx.map(j => String(r[j] || '').trim()).filter(Boolean).join(' & '),
        code: idx.code >= 0 ? String(r[idx.code] || '').trim() : '',
        jenis,
        kas_keluar: angka(r[idx.keluar]),
        kembalian: idx.masuk >= 0 ? angka(r[idx.masuk]) : 0,
      });
    }
    return { rows, lewatNonBiaya, lewatTanpaTanggal, error: rows.length ? '' : 'Header kas kecil ditemukan, tetapi tidak ada baris biaya.' };
  }
  return { rows: [], error: 'Kolom "Warehouse", "Jenis Transaksi", dan "kas keluar" tidak ditemukan.' };
}

// ---- Baca file "rekap-pengeluaran" (BBM & Tol): sheet "Per Kartu Etoll" (kartu e-toll)
// atau "Per Kartu Flazz" (kartu Flazz) -- keduanya sumber biaya yang sama. ----
// sheets = { namaSheet: aoa }
export function bacaEtoll(sheets) {
  const cari = re => Object.keys(sheets).find(n => re.test(n));
  const nKartu = cari(/kartu\s*(?:e-?toll|flazz)/i);
  if (!nKartu) return { rows: [], error: 'Sheet "Per Kartu Etoll" / "Per Kartu Flazz" tidak ditemukan.' };

  // Periode dari sheet Ringkasan ("01/09/2026 s.d. 30/09/2026"), cadangan: tanggal di sheet Detail.
  let periode = '';
  const nRingkas = cari(/ringkasan/i);
  for (const r of (nRingkas ? sheets[nRingkas] : [])) {
    if (normHeader(r[0]) === 'PERIODE') { periode = keTanggal(String(r[1] || '').split(/s\.?d\.?/i)[0]).slice(0, 7); break; }
  }
  if (!periode) {
    const nDetail = cari(/detail/i);
    const det = nDetail ? sheets[nDetail] : [];
    const iTgl = (det[0] || []).map(normHeader).indexOf('TANGGAL');
    if (iTgl >= 0) for (const r of det.slice(1)) { const t = keTanggal(r[iTgl]); if (t) { periode = t.slice(0, 7); break; } }
  }
  if (!periode) return { rows: [], error: 'Periode file e-toll tidak bisa dibaca (sheet Ringkasan / Detail).' };

  const aoa = sheets[nKartu];
  const kartuRe = /^KARTU\s+(?:E-?TOLL|FLAZZ)/;
  const hi = aoa.findIndex(r => (r || []).map(normHeader).some(x => kartuRe.test(x)));
  if (hi < 0) return { rows: [], error: 'Kolom "Kartu Etoll" / "Kartu Flazz" tidak ditemukan di sheet per kartu.' };
  const h = aoa[hi].map(normHeader);
  const iKartu = h.findIndex(x => kartuRe.test(x)), iWh = h.indexOf('WAREHOUSE');
  const iBbm = h.findIndex(x => /^BBM/.test(x)), iTol = h.findIndex(x => /^TOL/.test(x));

  const rows = [];
  const dilewati = [];
  for (const r of aoa.slice(hi + 1)) {
    const kartu = String(r[iKartu] || '').trim();
    const cabang = normCabang(r[iWh]);
    if (!kartu || !cabang || /^TOTAL$/i.test(kartu)) continue;
    const bbm = angka(r[iBbm]);
    const tol = angka(r[iTol]);
    if (!ETOLL_CABANG.includes(cabang)) { dilewati.push({ kartu, cabang, total: bbm + tol }); continue; }
    if (bbm) rows.push({ periode, cabang, no_ref: kartu, jenis: 'E-toll BBM', kas_keluar: bbm, kembalian: 0 });
    if (tol) rows.push({ periode, cabang, no_ref: kartu, jenis: 'E-toll Tol', kas_keluar: tol, kembalian: 0 });
  }
  return { rows, periode, dilewati, error: rows.length ? '' : 'Tidak ada kartu e-toll untuk ' + ETOLL_CABANG.join(', ') + '.' };
}

// ---- Olah data satu bulan jadi ringkasan per cabang ----
export function ringkasCabang(data) {
  const map = new Map();
  const ambil = c => {
    if (!map.has(c)) map.set(c, { cabang: c, whp: isWHP(c), kas: 0, etoll: 0, total: 0, omzet: 0, bungkus: 0, jenis: new Map() });
    return map.get(c);
  };
  for (const b of (data && data.biaya) || []) {
    const g = ambil(normCabang(b.cabang));
    const v = Number(b.biaya) || 0;
    if (b.sumber === 'ETOLL') g.etoll += v; else g.kas += v;
    g.total += v;
    const j = g.jenis.get(b.jenis) || { jenis: b.jenis, n: 0, biaya: 0 };
    j.n++;
    j.biaya += v;
    g.jenis.set(b.jenis, j);
  }
  for (const [c, o] of Object.entries((data && data.omzet) || {})) {
    if (isWHP(c)) continue;
    const g = ambil(c);
    g.omzet += o.omzet || 0;
    g.bungkus += o.bungkus || 0;
  }
  // Bulan tanpa upload kas kecil / e-toll sama sekali: biayanya "tidak diketahui"
  // (null), bukan 0 -- kalau 0, persen dan tren akan terlihat seperti biaya nol.
  const ada = !!data && (data.sumber_ada ? data.sumber_ada.length > 0 : ((data.biaya || []).length > 0));
  return [...map.values()].map(g => ({
    ...g,
    kas: ada ? g.kas : null,
    etoll: ada ? g.etoll : null,
    total: ada ? g.total : null,
    persen: ada && g.omzet > 0 ? g.total / g.omzet * 100 : null,
    perBungkus: ada && g.bungkus > 0 ? g.total / g.bungkus : null,
    jenis: [...g.jenis.values()].sort((a, b) => b.biaya - a.biaya),
  }));
}

// Jumlahkan satu kolom; null kalau semua nilainya null (bulan belum diupload).
function jumlah(arr, k) {
  let ada = false;
  let s = 0;
  for (const g of arr) {
    if (g[k] == null) continue;
    ada = true;
    s += g[k];
  }
  return ada ? s : null;
}

const fmtPersen = (p, d = 2) => (p == null ? '-' : p.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%');

// Untuk biaya, NAIK itu buruk (merah) dan TURUN itu baik (hijau).
function tren(ini, banding) {
  const a = Number(ini) || 0, b = Number(banding) || 0;
  if (a === b) return { simbol: '=', warna: 'text-slate-400', label: 'Sama' };
  return a > b ? { simbol: '▲', warna: 'text-red-600', label: 'Naik' } : { simbol: '▼', warna: 'text-emerald-600', label: 'Turun' };
}

// Bulan yang belum diupload sama sekali (bukan biaya nol): nilainya null dan
// ditampilkan "-", supaya tidak terbaca sebagai "biaya naik dari 0".
export const adaBiaya = d => !!(d && d.sumber_ada && d.sumber_ada.length);
const KOSONG = '<span class="text-slate-300">-</span>';
const numAtau = v => (v == null ? KOSONG : num(v));

function selSelisih(ini, banding, py = 'py-2') {
  if (ini == null || banding == null) return `<td class="px-4 ${py} text-right font-mono">${KOSONG}</td>`;
  const t = tren(ini, banding);
  const s = (Number(ini) || 0) - (Number(banding) || 0);
  return `<td class="px-4 ${py} text-right font-mono ${t.warna}">${s > 0 ? '+' : ''}${num(s)}</td>`;
}

function selTren(ini, banding, py = 'py-2') {
  if (ini == null || banding == null) return `<td class="px-4 ${py} text-center">${KOSONG}</td>`;
  const t = tren(ini, banding);
  return `<td class="px-4 ${py} text-center font-bold ${t.warna}" title="${t.label}">${t.simbol}<span class="sr-only">${t.label}</span></td>`;
}

function getCabangFilter() {
  return document.getElementById('biaya-cabang').value;
}

function filterCabang(list) {
  const c = getCabangFilter();
  return c === 'ALL' ? list : list.filter(g => g.cabang === c);
}

function populateCabang() {
  const sel = document.getElementById('biaya-cabang');
  const lama = sel.value;
  const semua = new Set([...ringkasCabang(state.data), ...ringkasCabang(state.dataB)].map(g => g.cabang));
  const urut = [...semua].sort((a, b) => isWHP(a) - isWHP(b) || a.localeCompare(b));
  sel.innerHTML = '<option value="ALL">Semua Cabang</option>';
  urut.forEach(c => sel.add(new Option(isWHP(c) ? c : 'WHO ' + c, c)));
  if (urut.includes(lama)) sel.value = lama;
}

function statusSumber(d, label) {
  if (!d || !d.bulan) return `<span class="text-amber-700">${esc(label)}: belum ada data.</span>`;
  const n = s => (d.biaya || []).filter(b => b.sumber === s).length;
  const ada = s => d.sumber_ada && d.sumber_ada.includes(s);
  const kas = ada('KAS_KECIL') ? `<span class="text-emerald-700">✓ Kas Kecil (${num(n('KAS_KECIL'))} transaksi)</span>` : '<span class="text-amber-700">✗ Kas Kecil belum diupload</span>';
  const et = ada('ETOLL') ? `<span class="text-emerald-700">✓ E-toll (${num(n('ETOLL'))} baris kartu)</span>` : '<span class="text-amber-700">✗ E-toll belum diupload</span>';
  return `<b>${esc(bulanTeks(d.bulan))}</b>: ${kas} · ${et}`;
}

function renderInfo() {
  const box = document.getElementById('biaya-info');
  let html = statusSumber(state.data, bulanTeks(state.bulan) || 'Bulan ini');
  if (state.modeBanding) html += '<br>' + statusSumber(state.dataB, bulanTeks(state.banding));
  box.innerHTML = html;
  box.classList.remove('hidden');
}

function barisJenis(g, kolom, gB) {
  // Baris rincian jenis biaya di bawah cabang yang dibuka.
  if (!state.terbuka.has(g.cabang)) return '';
  const jenisB = new Map(((gB && gB.jenis) || []).map(j => [j.jenis, j]));
  const semua = [...new Set([...g.jenis.map(j => j.jenis), ...jenisB.keys()])];
  const byNama = new Map(g.jenis.map(j => [j.jenis, j]));
  semua.sort((a, b) => ((byNama.get(b) || {}).biaya || 0) - ((byNama.get(a) || {}).biaya || 0));
  let html = '';
  for (const nama of semua) {
    const j = byNama.get(nama) || { n: 0, biaya: g.total == null ? null : 0 };
    const jb = jenisB.get(nama) || { n: 0, biaya: adaBiaya(state.dataB) ? 0 : null };
    const label = `<td class="pl-12 pr-4 py-1.5 text-slate-600 whitespace-nowrap">${esc(nama)} <span class="text-slate-400">· ${num(j.n)} trx</span></td>`;
    if (state.modeBanding) {
      html += `<tr class="bg-slate-50 text-xs">${label}
        <td class="px-4 py-1.5 text-right font-mono text-slate-500">${numAtau(jb.biaya)}</td>
        <td class="px-4 py-1.5 text-right font-mono text-slate-700">${numAtau(j.biaya)}</td>
        ${selSelisih(j.biaya, jb.biaya, 'py-1.5')}
        <td colspan="${kolom - 4}"></td></tr>`;
    } else {
      // Kolom: nama | kas kecil | e-toll | total | (sisa kolom: porsi dari biaya cabang)
      const pct = g.total ? j.biaya / g.total * 100 : 0;
      const sisa = kolom - 4;
      html += `<tr class="bg-slate-50 text-xs">${label}
        <td colspan="2"></td>
        <td class="px-4 py-1.5 text-right font-mono text-slate-700" title="${fmtPersen(pct, 1)} dari biaya">${num(j.biaya)}</td>
        ${sisa > 0 ? `<td colspan="${sisa}" class="px-4 py-1.5 text-slate-400">${fmtPersen(pct, 1)} dari biaya cabang</td>` : ''}</tr>`;
    }
  }
  return html;
}

function barisCabangKlik(c) {
  return `data-cab="${esc(c)}" class="hover:bg-slate-50 cursor-pointer transition-colors"`;
}

function ikon(c) {
  return `<i class="fas fa-chevron-${state.terbuka.has(c) ? 'down' : 'right'} text-[10px] text-slate-400 mr-2 w-3"></i>`;
}

function namaCabang(c) {
  return isWHP(c) ? c : 'WHO ' + c;
}

function renderWHO() {
  const thead = document.getElementById('biaya-who-thead');
  const tbody = document.getElementById('biaya-who-tbody');
  const tfoot = document.getElementById('biaya-who-tfoot');
  const list = filterCabang(ringkasCabang(state.data).filter(g => !g.whp));
  const mapB = new Map(ringkasCabang(state.dataB).map(g => [g.cabang, g]));
  const th = (t, a = 'text-right') => `<th class="px-4 py-3 ${a} whitespace-nowrap">${t}</th>`;

  if (state.modeBanding) {
    const bB = esc(bulanPendek(state.banding)), bI = esc(bulanPendek(state.bulan));
    thead.innerHTML = `<tr>${th('Cabang', 'text-left')}${th('Biaya ' + bB)}${th('Biaya ' + bI)}${th('Selisih (Rp)')}${th('Omzet ' + bB)}${th('Omzet ' + bI)}${th('% ' + bB)}${th('% ' + bI)}${th('Tren %', 'text-center')}</tr>`;
  } else {
    thead.innerHTML = `<tr>${th('Cabang', 'text-left')}${th('Kas Kecil')}${th('E-toll')}${th('Total Biaya')}${th('Omzet')}${th('Bungkus')}${th('% Biaya / Omzet')}${th('Biaya / Bks')}</tr>`;
  }
  const kolom = state.modeBanding ? 9 : 8;

  // Cabang yang hanya ada di bulan pembanding tetap ditampilkan saat membandingkan.
  if (state.modeBanding) {
    const ada = new Set(list.map(g => g.cabang));
    for (const g of filterCabang([...mapB.values()].filter(x => !x.whp))) {
      if (!ada.has(g.cabang)) { const z = adaBiaya(state.data) ? 0 : null; list.push({ ...g, kas: z, etoll: z, total: z, omzet: 0, bungkus: 0, persen: null, perBungkus: null, jenis: [] }); }
    }
  }
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${kolom}" class="px-4 py-8 text-center text-slate-500">Belum ada data biaya / omzet cabang untuk bulan ini.</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }
  list.sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1) || (b.total || 0) - (a.total || 0));

  const okB = adaBiaya(state.dataB);
  let html = '';
  for (const g of list) {
    const gB = mapB.get(g.cabang) || { total: okB ? 0 : null, omzet: 0, persen: null, jenis: [] };
    if (state.modeBanding) {
      html += `<tr ${barisCabangKlik(g.cabang)}>
        <td class="px-4 py-2 font-semibold text-slate-700 whitespace-nowrap">${ikon(g.cabang)}${esc(namaCabang(g.cabang))}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-500">${numAtau(gB.total)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold text-slate-800">${numAtau(g.total)}</td>
        ${selSelisih(g.total, gB.total)}
        <td class="px-4 py-2 text-right font-mono text-slate-500">${num(gB.omzet)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-700">${num(g.omzet)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-500">${fmtPersen(gB.persen)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold text-slate-800">${fmtPersen(g.persen)}</td>
        ${selTren(g.persen, gB.persen)}</tr>`;
    } else {
      const warna = g.persen == null ? 'text-slate-400' : g.persen >= 0.5 ? 'text-red-600' : g.persen >= 0.3 ? 'text-amber-600' : 'text-emerald-600';
      html += `<tr ${barisCabangKlik(g.cabang)}>
        <td class="px-4 py-2 font-semibold text-slate-700 whitespace-nowrap">${ikon(g.cabang)}${esc(namaCabang(g.cabang))}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-600">${numAtau(g.kas)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-600">${g.etoll ? num(g.etoll) : KOSONG}</td>
        <td class="px-4 py-2 text-right font-mono font-bold text-slate-800">${numAtau(g.total)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-600">${num(g.omzet)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-600">${num(g.bungkus)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold ${warna}">${fmtPersen(g.persen)}</td>
        <td class="px-4 py-2 text-right font-mono text-slate-600">${g.perBungkus == null ? '-' : 'Rp ' + num(g.perBungkus)}</td></tr>`;
    }
    html += barisJenis(g, kolom, gB);
  }
  tbody.innerHTML = html;

  const tTot = jumlah(list, 'total'), tOm = jumlah(list, 'omzet') || 0, tBk = jumlah(list, 'bungkus') || 0;
  const pI = tTot != null && tOm ? tTot / tOm * 100 : null;
  if (state.modeBanding) {
    const listB = list.map(g => mapB.get(g.cabang) || { total: okB ? 0 : null, omzet: 0 });
    const bTot = jumlah(listB, 'total'), bOm = jumlah(listB, 'omzet') || 0;
    const pB = bTot != null && bOm ? bTot / bOm * 100 : null;
    tfoot.innerHTML = `<tr><td class="px-4 py-3 uppercase tracking-wider">Total WHO</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(bTot)}</td><td class="px-4 py-3 text-right font-mono">${numAtau(tTot)}</td>
      ${selSelisih(tTot, bTot, 'py-3')}
      <td class="px-4 py-3 text-right font-mono">${num(bOm)}</td><td class="px-4 py-3 text-right font-mono">${num(tOm)}</td>
      <td class="px-4 py-3 text-right font-mono">${fmtPersen(pB)}</td><td class="px-4 py-3 text-right font-mono">${fmtPersen(pI)}</td>
      ${selTren(pI, pB, 'py-3')}</tr>`;
  } else {
    tfoot.innerHTML = `<tr><td class="px-4 py-3 uppercase tracking-wider">Total WHO</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(jumlah(list, 'kas'))}</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(jumlah(list, 'etoll'))}</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(tTot)}</td>
      <td class="px-4 py-3 text-right font-mono">${num(tOm)}</td>
      <td class="px-4 py-3 text-right font-mono">${num(tBk)}</td>
      <td class="px-4 py-3 text-right font-mono">${fmtPersen(pI)}</td>
      <td class="px-4 py-3 text-right font-mono">${tTot != null && tBk ? 'Rp ' + num(tTot / tBk) : '-'}</td></tr>`;
  }
}

function renderWHP() {
  const wrap = document.getElementById('biaya-whp-wrap');
  const thead = document.getElementById('biaya-whp-thead');
  const tbody = document.getElementById('biaya-whp-tbody');
  const tfoot = document.getElementById('biaya-whp-tfoot');
  const list = filterCabang(ringkasCabang(state.data).filter(g => g.whp));
  const mapB = new Map(ringkasCabang(state.dataB).map(g => [g.cabang, g]));
  if (state.modeBanding) {
    const ada = new Set(list.map(g => g.cabang));
    for (const g of filterCabang([...mapB.values()].filter(x => x.whp))) if (!ada.has(g.cabang)) { const z = adaBiaya(state.data) ? 0 : null; list.push({ ...g, kas: z, etoll: z, total: z, jenis: [] }); }
  }
  wrap.classList.toggle('hidden', list.length === 0);
  if (list.length === 0) return;
  list.sort((a, b) => (b.total || 0) - (a.total || 0));
  const okB = adaBiaya(state.dataB);
  const th = (t, a = 'text-right') => `<th class="px-4 py-3 ${a} whitespace-nowrap">${t}</th>`;
  const kolom = state.modeBanding ? 5 : 4;
  thead.innerHTML = state.modeBanding
    ? `<tr>${th('Gudang', 'text-left')}${th('Biaya ' + esc(bulanPendek(state.banding)))}${th('Biaya ' + esc(bulanPendek(state.bulan)))}${th('Selisih (Rp)')}${th('Tren', 'text-center')}</tr>`
    : `<tr>${th('Gudang', 'text-left')}${th('Kas Kecil')}${th('E-toll')}${th('Total Biaya')}</tr>`;

  let html = '';
  for (const g of list) {
    const gB = mapB.get(g.cabang) || { total: okB ? 0 : null, jenis: [] };
    html += state.modeBanding
      ? `<tr ${barisCabangKlik(g.cabang)}>
          <td class="px-4 py-2 font-semibold text-slate-700 whitespace-nowrap">${ikon(g.cabang)}${esc(g.cabang)}</td>
          <td class="px-4 py-2 text-right font-mono text-slate-500">${numAtau(gB.total)}</td>
          <td class="px-4 py-2 text-right font-mono font-bold text-slate-800">${numAtau(g.total)}</td>
          ${selSelisih(g.total, gB.total)}${selTren(g.total, gB.total)}</tr>`
      : `<tr ${barisCabangKlik(g.cabang)}>
          <td class="px-4 py-2 font-semibold text-slate-700 whitespace-nowrap">${ikon(g.cabang)}${esc(g.cabang)}</td>
          <td class="px-4 py-2 text-right font-mono text-slate-600">${numAtau(g.kas)}</td>
          <td class="px-4 py-2 text-right font-mono text-slate-600">${g.etoll ? num(g.etoll) : KOSONG}</td>
          <td class="px-4 py-2 text-right font-mono font-bold text-slate-800">${numAtau(g.total)}</td></tr>`;
    html += barisJenis(g, kolom, gB);
  }
  tbody.innerHTML = html;

  if (state.modeBanding) {
    const bTot = jumlah(list.map(g => mapB.get(g.cabang) || { total: okB ? 0 : null }), 'total');
    const tTot = jumlah(list, 'total');
    tfoot.innerHTML = `<tr><td class="px-4 py-3 uppercase tracking-wider">Total WHP</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(bTot)}</td><td class="px-4 py-3 text-right font-mono">${numAtau(tTot)}</td>
      ${selSelisih(tTot, bTot, 'py-3')}${selTren(tTot, bTot, 'py-3')}</tr>`;
  } else {
    tfoot.innerHTML = `<tr><td class="px-4 py-3 uppercase tracking-wider">Total WHP</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(jumlah(list, 'kas'))}</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(jumlah(list, 'etoll'))}</td>
      <td class="px-4 py-3 text-right font-mono">${numAtau(jumlah(list, 'total'))}</td></tr>`;
  }
}

function render() {
  renderInfo();
  renderWHO();
  renderWHP();
  document.querySelectorAll('#biaya-omzet-view tr[data-cab]').forEach(tr => {
    tr.addEventListener('click', () => {
      const c = tr.getAttribute('data-cab');
      if (state.terbuka.has(c)) state.terbuka.delete(c); else state.terbuka.add(c);
      render();
    });
  });
}

export function loadBiayaOmzet() {
  const bulanEl = document.getElementById('biaya-bulan');
  const bulan = bulanEl.value;
  const banding = document.getElementById('biaya-banding').value;
  const aktif = document.getElementById('biaya-banding-aktif').checked && bulan && banding && banding !== bulan;
  const loader = document.getElementById('biaya-loader');
  const content = document.getElementById('biaya-content');
  loader.classList.remove('hidden');
  loader.classList.add('flex');
  content.classList.add('hidden');

  return Promise.all([
    callApi('getBiayaCabang', bulan),
    aktif ? callApi('getBiayaCabang', banding) : Promise.resolve(null),
  ])
    .then(([res, resB]) => {
      state.data = res.data || null;
      // Bulan kosong = backend memilih bulan terakhir yang sudah diupload.
      state.bulan = (state.data && state.data.bulan) || bulan;
      if (!bulan && state.bulan) {
        bulanEl.value = state.bulan;
        setBandingSebelum();
        // Bulan baru diketahui sekarang -> muat ulang supaya bulan pembanding ikut tampil.
        if (document.getElementById('biaya-banding-aktif').checked) return loadBiayaOmzet();
      }
      state.dataB = resB ? resB.data : null;
      state.modeBanding = !!resB;
      state.banding = resB ? ((resB.data && resB.data.bulan) || banding) : '';
      populateCabang();
      render();
    })
    .catch(err => alert('Gagal memuat Biaya vs Omzet: ' + err.message))
    .finally(() => {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
      content.classList.remove('hidden');
    });
}

function setBandingSebelum() {
  const bulan = document.getElementById('biaya-bulan').value;
  const [y, m] = bulan.split('-').map(Number);
  if (!y || !m) return;
  const p = new Date(y, m - 2, 1);
  document.getElementById('biaya-banding').value = `${p.getFullYear()}-${pad(p.getMonth() + 1)}`;
}

// ---- Upload ----
function bacaFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheets = {};
        for (const n of wb.SheetNames) sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('File tidak bisa dibaca'));
    reader.readAsArrayBuffer(file);
  });
}

// Tentukan jenis file dari isinya, bukan dari nama file.
export function kenaliFile(sheets) {
  if (Object.keys(sheets).some(n => /kartu\s*(?:e-?toll|flazz)/i.test(n))) return { sumber: 'ETOLL', ...bacaEtoll(sheets) };
  for (const aoa of Object.values(sheets)) {
    const h = bacaKasKecil(aoa);
    if (h.rows.length || !/tidak ditemukan/.test(h.error)) return { sumber: 'KAS_KECIL', ...h };
  }
  return { sumber: '', rows: [], error: 'File tidak dikenali. Pilih file "Rekap Kas Kecil" atau "rekap-pengeluaran" (BBM & Tol) yang punya sheet "Per Kartu Etoll" / "Per Kartu Flazz".' };
}

async function uploadFiles(files) {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }
  let terakhir = '';
  for (const file of files) {
    let hasil;
    try {
      hasil = kenaliFile(await bacaFile(file));
    } catch (err) {
      alert(`${file.name}: file tidak bisa dibaca (${err.message}).`);
      continue;
    }
    if (hasil.error) {
      alert(`${file.name}:\n${hasil.error}`);
      continue;
    }
    const periode = [...new Set(hasil.rows.map(r => r.periode))].sort();
    const total = hasil.rows.reduce((a, r) => a + r.kas_keluar - r.kembalian, 0);
    let pesan;
    if (hasil.sumber === 'KAS_KECIL') {
      const cab = new Set(hasil.rows.map(r => r.cabang)).size;
      pesan = `File KAS KECIL: ${file.name}\nPeriode: ${periode.map(bulanTeks).join(', ')}\n`
        + `${num(hasil.rows.length)} transaksi biaya dari ${cab} cabang/gudang, total biaya bersih Rp ${num(total)}.\n`
        + `${num(hasil.lewatNonBiaya)} baris bukan biaya dilewati (Masuk Kas Kecil, Setoran Tunai, Closing Kas, Tukar Denom).`
        + (hasil.lewatTanpaTanggal ? `\n${num(hasil.lewatTanpaTanggal)} baris tanpa tanggal dilewati.` : '');
    } else {
      const lewat = hasil.dilewati || [];
      pesan = `File E-TOLL: ${file.name}\nPeriode: ${bulanTeks(hasil.periode)}\n`
        + `Diambil untuk ${ETOLL_CABANG.join(', ')}: total Rp ${num(total)}.\n`
        + (lewat.length ? `${lewat.length} kartu cabang lain dilewati (sudah tercatat lewat Pengisian ETOLL di kas kecil).` : '');
    }
    pesan += `\n\nData ${hasil.sumber === 'KAS_KECIL' ? 'kas kecil' : 'e-toll'} bulan tersebut yang sudah ada akan DIGANTI. Lanjutkan?`;
    if (!confirm(pesan)) continue;
    try {
      const res = await callApi('simpanBiayaCabang', hasil.rows, hasil.sumber);
      showToast(`${file.name}: ${num((res.data && res.data.saved) || hasil.rows.length)} baris tersimpan`, 'success');
      terakhir = periode[periode.length - 1] || terakhir;
    } catch (err) {
      alert(`Gagal menyimpan ${file.name}: ${err.message}`);
    }
  }
  if (terakhir) {
    document.getElementById('biaya-bulan').value = terakhir;
    setBandingSebelum();
    await loadBiayaOmzet();
  }
}

// ---- Export Excel ----
export function exportBiayaOmzet() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }
  const semua = filterCabang(ringkasCabang(state.data));
  if (!semua.length) {
    alert('Tidak ada data untuk diexport.');
    return;
  }
  const cabSel = document.getElementById('biaya-cabang');
  const cabLabel = cabSel.value === 'ALL' ? 'SEMUA CABANG' : cabSel.options[cabSel.selectedIndex].text;
  const periode = state.modeBanding ? `${bulanTeks(state.banding)} VS ${bulanTeks(state.bulan)}` : bulanTeks(state.bulan);
  const judul = t => [['PT TRIDAYA SINERGI INDONESIA'], [t], [cabLabel], [`PERIODE ${periode.toUpperCase()}`], []];
  const tebal = { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } };
  const pct = p => (p == null ? '' : Math.round(p * 100) / 100);
  const fmtPct = (ws, aoa, kolom) => {
    for (let r = 6; r < aoa.length; r++) for (const c of kolom) {
      const ref = XLSX.utils.encode_cell({ c, r });
      if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '0.00"%"';
    }
  };
  const who = semua.filter(g => !g.whp).sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1));
  const whp = semua.filter(g => g.whp).sort((a, b) => (b.total || 0) - (a.total || 0));
  const mapB = new Map(ringkasCabang(state.dataB).map(g => [g.cabang, g]));
  // Bulan yang belum diupload -> sel kosong (bukan 0), sama seperti di layar.
  const okB = adaBiaya(state.dataB);
  const v = x => (x == null ? '' : x);
  const sum = (arr, k) => jumlah(arr, k);
  const selisih = (a, b) => (a == null || b == null ? '' : a - b);
  const rasio = (a, b) => (a == null || !b ? null : a / b * 100);
  const kosongB = { total: okB ? 0 : null, omzet: 0, persen: null };

  // Sheet 1: Ringkasan
  const s1 = judul('BIAYA KAS KECIL & E-TOLL VS OMZET');
  const tebalIdx = [];
  let hdrWhp = -1;
  let pctKolom;
  if (state.modeBanding) {
    const bB = bulanPendek(state.banding).toUpperCase(), bI = bulanPendek(state.bulan).toUpperCase();
    s1.push(['CABANG', `BIAYA ${bB} (Rp)`, `BIAYA ${bI} (Rp)`, 'SELISIH BIAYA (Rp)', `OMZET ${bB} (Rp)`, `OMZET ${bI} (Rp)`, `% BIAYA/OMZET ${bB}`, `% BIAYA/OMZET ${bI}`]);
    for (const g of who) {
      const b = mapB.get(g.cabang) || kosongB;
      s1.push([namaCabang(g.cabang), v(b.total), v(g.total), selisih(g.total, b.total), b.omzet, g.omzet, pct(b.persen), pct(g.persen)]);
    }
    const lb = who.map(g => mapB.get(g.cabang) || kosongB);
    tebalIdx.push(s1.length);
    s1.push(['TOTAL WHO', v(sum(lb, 'total')), v(sum(who, 'total')), selisih(sum(who, 'total'), sum(lb, 'total')), v(sum(lb, 'omzet')), v(sum(who, 'omzet')),
      pct(rasio(sum(lb, 'total'), sum(lb, 'omzet'))), pct(rasio(sum(who, 'total'), sum(who, 'omzet')))]);
    pctKolom = [6, 7];
    if (whp.length) {
      s1.push([]);
      s1.push(['PENGELUARAN GUDANG (WHP)']);
      hdrWhp = s1.length;
      s1.push(['GUDANG', `BIAYA ${bB} (Rp)`, `BIAYA ${bI} (Rp)`, 'SELISIH BIAYA (Rp)']);
      for (const g of whp) { const b = mapB.get(g.cabang) || kosongB; s1.push([g.cabang, v(b.total), v(g.total), selisih(g.total, b.total)]); }
      const wb = whp.map(g => mapB.get(g.cabang) || kosongB);
      tebalIdx.push(s1.length);
      s1.push(['TOTAL WHP', v(sum(wb, 'total')), v(sum(whp, 'total')), selisih(sum(whp, 'total'), sum(wb, 'total'))]);
    }
  } else {
    s1.push(['CABANG', 'BIAYA KAS KECIL (Rp)', 'BIAYA E-TOLL (Rp)', 'TOTAL BIAYA (Rp)', 'OMZET (Rp)', 'BUNGKUS TERJUAL', '% BIAYA / OMZET', 'BIAYA PER BUNGKUS (Rp)']);
    for (const g of who) s1.push([namaCabang(g.cabang), v(g.kas), v(g.etoll), v(g.total), g.omzet, g.bungkus, pct(g.persen), g.perBungkus == null ? '' : Math.round(g.perBungkus)]);
    const tT = sum(who, 'total'), tO = sum(who, 'omzet') || 0, tB = sum(who, 'bungkus') || 0;
    tebalIdx.push(s1.length);
    s1.push(['TOTAL WHO', v(sum(who, 'kas')), v(sum(who, 'etoll')), v(tT), tO, tB, pct(rasio(tT, tO)), tT != null && tB ? Math.round(tT / tB) : '']);
    pctKolom = [6];
    if (whp.length) {
      s1.push([]);
      s1.push(['PENGELUARAN GUDANG (WHP)']);
      hdrWhp = s1.length;
      s1.push(['GUDANG', 'BIAYA KAS KECIL (Rp)', 'BIAYA E-TOLL (Rp)', 'TOTAL BIAYA (Rp)']);
      for (const g of whp) s1.push([g.cabang, v(g.kas), v(g.etoll), v(g.total)]);
      tebalIdx.push(s1.length);
      s1.push(['TOTAL WHP', v(sum(whp, 'kas')), v(sum(whp, 'etoll')), v(sum(whp, 'total'))]);
    }
    s1.push([]);
    tebalIdx.push(s1.length);
    s1.push(['TOTAL SEMUA BIAYA (WHO + WHP)', v(sum(semua, 'kas')), v(sum(semua, 'etoll')), v(sum(semua, 'total'))]);
  }
  s1.push([]);
  s1.push(['Catatan:']);
  s1.push(['- Biaya kas kecil = kas keluar dikurangi kembalian. Masuk Kas Kecil, Setoran Tunai Kas Kecil, Closing Kas, dan Tukar Denom tidak dihitung sebagai biaya.']);
  s1.push([`- Biaya e-toll (BBM & tol, sheet "Per Kartu Etoll") hanya untuk ${ETOLL_CABANG.join(', ')}; cabang lain mengisi saldo e-toll lewat kas kecil.`]);
  s1.push(['- Omzet = penjualan semua pembeli (MST, MSI, STK, ORE, ORM), sama dengan menu Rekap Belanja. Gudang (WHP) hanya direkap pengeluarannya.']);
  const ws1 = XLSX.utils.aoa_to_sheet(s1);
  formatAngka(ws1);
  fmtPct(ws1, s1, pctKolom);
  rapikanSheet(ws1, s1);
  if (hdrWhp >= 0) {
    gayaHeader(ws1, hdrWhp, s1[hdrWhp].length);
    const ref = XLSX.utils.encode_cell({ c: 0, r: hdrWhp - 1 });
    if (ws1[ref]) ws1[ref].s = { font: { bold: true } };
  }
  tebalIdx.forEach(r => gayaBaris(ws1, r, Math.max(s1[r].length, 4), tebal));

  // Sheet 2: per jenis biaya (bulan ini)
  const totJenis = new Map();
  for (const g of semua) for (const j of g.jenis) totJenis.set(j.jenis, (totJenis.get(j.jenis) || 0) + j.biaya);
  const jenisUrut = [...totJenis.keys()].sort((a, b) => totJenis.get(b) - totJenis.get(a));
  const kol = [...who, ...whp];
  const s2 = judul(`BIAYA PER JENIS TRANSAKSI (Rp) - ${bulanTeks(state.bulan).toUpperCase()}`);
  s2.push(['JENIS BIAYA', ...kol.map(g => namaCabang(g.cabang)), 'TOTAL']);
  for (const nama of jenisUrut) {
    s2.push([nama, ...kol.map(g => (g.jenis.find(j => j.jenis === nama) || { biaya: 0 }).biaya), totJenis.get(nama)]);
  }
  const t2 = s2.length;
  s2.push(['TOTAL BIAYA', ...kol.map(g => v(g.total)), v(sum(kol, 'total'))]);
  const ws2 = XLSX.utils.aoa_to_sheet(s2);
  formatAngka(ws2);
  rapikanSheet(ws2, s2);
  gayaBaris(ws2, t2, kol.length + 2, tebal);

  // Sheet 3: detail transaksi (bulan ini)
  const pilih = new Set(semua.map(g => g.cabang));
  const s3 = judul(`DETAIL BIAYA - ${bulanTeks(state.bulan).toUpperCase()}`);
  s3.push(['CABANG', 'SUMBER', 'TANGGAL', 'NO. KAS KELUAR', 'NO. REFERENSI / KARTU', 'NAMA', 'CODE', 'JENIS BIAYA', 'KAS KELUAR (Rp)', 'KEMBALIAN (Rp)', 'BIAYA BERSIH (Rp)']);
  const detail = ((state.data && state.data.biaya) || [])
    .filter(b => pilih.has(normCabang(b.cabang)))
    .sort((a, b) => normCabang(a.cabang).localeCompare(normCabang(b.cabang)) || String(a.tanggal || '').localeCompare(String(b.tanggal || '')));
  for (const b of detail) {
    const t = b.tanggal ? b.tanggal.split('-').reverse().join('/') : '';
    s3.push([namaCabang(normCabang(b.cabang)), b.sumber === 'ETOLL' ? 'E-toll' : 'Kas Kecil', t, b.no_kas || '', b.no_ref || '', b.nama || '', b.code || '',
      b.jenis, Number(b.kas_keluar) || 0, Number(b.kembalian) || 0, Number(b.biaya) || 0]);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(s3);
  formatAngka(ws3);
  rapikanSheet(ws3, s3, { filter: true });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');
  XLSX.utils.book_append_sheet(wb, ws2, 'Per Jenis Biaya');
  XLSX.utils.book_append_sheet(wb, ws3, 'Detail Biaya');
  const fileName = `Biaya vs Omzet ${periode}${cabSel.value === 'ALL' ? '' : ' ' + cabSel.value}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('File Excel berhasil diunduh: ' + fileName, 'success');
}

let sudahInit = false;

export function initBiayaOmzet() {
  if (sudahInit) return;
  sudahInit = true;

  const bandingAktif = document.getElementById('biaya-banding-aktif');
  const banding = document.getElementById('biaya-banding');
  document.getElementById('biaya-bulan').addEventListener('change', setBandingSebelum);
  const sinkron = () => { banding.disabled = !bandingAktif.checked; };
  bandingAktif.addEventListener('change', sinkron);
  sinkron();

  document.getElementById('btn-biaya-terapkan').addEventListener('click', loadBiayaOmzet);
  document.getElementById('biaya-cabang').addEventListener('change', () => { state.terbuka = new Set(); render(); });
  document.getElementById('btn-biaya-export').addEventListener('click', exportBiayaOmzet);
  const fileInput = document.getElementById('biaya-file');
  document.getElementById('btn-biaya-upload').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const files = [...(fileInput.files || [])];
    fileInput.value = '';
    if (files.length) uploadFiles(files);
  });

  // Bulan dikosongkan dulu: backend memilih bulan terakhir yang sudah diupload.
  loadBiayaOmzet();
}
