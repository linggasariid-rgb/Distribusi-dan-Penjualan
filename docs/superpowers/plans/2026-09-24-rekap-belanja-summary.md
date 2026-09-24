# Rekap Belanja — Ringkasan Bulanan (Group per Cabang) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah menu Rekap Belanja menjadi ringkasan bulanan per customer (group per cabang) di layar & export, dan memastikan nama customer tersimpan untuk data baru.

**Architecture:** Backend `report-belanja-stokis.js` mengagregasi transaksi per `(cabang, nama_customer)` lalu mengembalikan baris ringkasan. Frontend `rekapBelanja.js` merender tabel group per cabang (dengan subtotal cabang) dan export Excel dengan layout ringkasan yang sama. `save-penjualan-who.js` diperbaiki agar mendeteksi kolom nama `NAMA CUSTOMER` (bukan hanya `NAMA PDM`).

**Tech Stack:** Cloudflare Workers (ESM), Supabase (PostgREST), Vanilla JS SPA, SheetJS `xlsx` untuk export. Test: Node `node:assert` (`.test.mjs`), tanpa framework.

## Global Constraints

- Endpoint URL, nama param, dan folder tetap: `GET /api/report-belanja-stokis?month=...`.
- Kategori: prefix `MST`/`MSI` → `Master Stokis`; `STK`/`STOKIS` → `Stokis`; `KARYAWAN`/`ORE`/`TSIEMPLOYEE` → `Karyawan`; `APPS`/`ORM`/`TSIAPPS` → `Apps`; selain itu diskip.
- Harga: kategori selain `Karyawan` memakai `price_mst`; `Karyawan` memakai `price_stk` (field `karyawan`). `HU` tidak dihitung dalam `total_bungkus` tapi tetap masuk nominal (pakai `price_mst`).
- `PRODUCT_COLS` = 20 produk tetap (const eksisting di frontend). `TOTAL_COLS = PRODUCT_COLS.length + 2`.
- Urutan kolom layar & export: `Nama | Tipe | Cabang | <produk> | Total Bungkus | Total Nominal`.
- Tidak ada backfill data lama; data lama (tanpa nama) tampil ber-label kode tipe.
- Test dijalankan dengan `node tests/<file>.test.mjs` dari root repo. Warning `MODULE_TYPELESS_PACKAGE_JSON` boleh muncul (aman, karena import otomatis mendeteksi ESM).

---
---

### Task 1: Backend — agregasi ringkasan di `report-belanja-stokis.js`

**Files:**
- Modify: `worker/src/routes/report-belanja-stokis.js`
- Test: `tests/rekap-belanja-backend.test.mjs` (Create)

**Interfaces:**
- Produces (dipakai Task 2-5):
  - `export function detectCategory(tipeUpper) => string` ('' jika tak dikenal)
  - `export function computeTransaction(r, priceMap, targetMonth) => object|null`
  - `export function aggregateSummary(transactions) => array<{nama_customer, kategori, cabang, products, total_bungkus, total_nominal}>`
  - `export async function handle(db, monthFilter) => { status:'success', data: [ringkasan] }` — urut `cabang` asc, lalu `nama_customer` asc.

- [ ] **Step 1: Write the failing test**

Create `tests/rekap-belanja-backend.test.mjs`:

```js
import assert from 'node:assert/strict';
import { detectCategory, computeTransaction, aggregateSummary } from '../worker/src/routes/report-belanja-stokis.js';

// detectCategory
assert.equal(detectCategory('MST'), 'Master Stokis');
assert.equal(detectCategory('MSI INDEPENDEN 4'), 'Master Stokis');
assert.equal(detectCategory('STK BIR ALI'), 'Stokis');
assert.equal(detectCategory('STOKIS'), 'Stokis');
assert.equal(detectCategory('ORE STOKIS ONLINE'), 'Karyawan');
assert.equal(detectCategory('TSIEMPLOYEE'), 'Karyawan');
assert.equal(detectCategory('ORM STOKIS ONLINE'), 'Apps');
assert.equal(detectCategory('TSIAPPS'), 'Apps');
assert.equal(detectCategory('PELANGGAN'), '');

// computeTransaction
const priceMap = { 'SPS TSI': { mst: 10000, karyawan: 8000 }, HU: { mst: 9000, karyawan: 9000 } };
const t = computeTransaction(
  { tanggal: '2026-09-23', cabang: 'BANDUNG', tipe_customer: 'MST X', products: { 'SPS TSI': 50, HU: 2 } },
  priceMap, '2026-09'
);
assert.equal(t.kategori, 'Master Stokis');
assert.equal(t.total_bungkus, 50, 'HU tidak dihitung bungkus');
assert.equal(t.total_nominal, 50 * 10000 + 2 * 9000, 'HU tetap dihitung nominal');
assert.equal(computeTransaction({ tanggal: '2026-08-01', cabang: 'B', tipe_customer: 'MST', products: {} }, priceMap, '2026-09'), null, 'tanggal di luar bulan -> null');
assert.equal(computeTransaction({ tanggal: '2026-09-01', cabang: 'B', tipe_customer: 'ASING', products: {} }, priceMap, '2026-09'), null, 'tipe tak dikenal -> null');

// aggregateSummary
const rows = [
  { tanggal: '2026-09-23', cabang: 'BANDUNG', nama_customer: 'MST B', kategori: 'Master Stokis', products: { 'SPS TSI': 10 }, total_bungkus: 10, total_nominal: 100000 },
  { tanggal: '2026-09-22', cabang: 'BANDUNG', nama_customer: 'MST B', kategori: 'Master Stokis', products: { 'SPS TSI': 5, HU: 3 }, total_bungkus: 5, total_nominal: 50000 },
  { tanggal: '2026-09-21', cabang: 'GARUT',  nama_customer: 'STK A', kategori: 'Stokis', products: { 'SKM TSI': 7 }, total_bungkus: 7, total_nominal: 70000 },
];
const s = aggregateSummary(rows);
assert.equal(s.length, 2);
assert.equal(s[0].cabang, 'BANDUNG', 'urut cabang asc');
assert.equal(s[0].nama_customer, 'MST B');
assert.equal(s[0].products['SPS TSI'], 15, 'produk dijumlahkan');
assert.equal(s[0].products['HU'], 3);
assert.equal(s[0].total_bungkus, 15);
assert.equal(s[0].total_nominal, 150000);
assert.equal(s[1].cabang, 'GARUT');

console.log('OK: semua tes backend rekap belanja lolos');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/rekap-belanja-backend.test.mjs`

Expected: FAIL — `detectCategory` / `aggregateSummary` / `computeTransaction` tidak ter-export (tidak ada).

- [ ] **Step 3: Rewrite `worker/src/routes/report-belanja-stokis.js`**

Replace seluruh isi file dengan:

```js
export function detectCategory(tipeUpper) {
  if (tipeUpper.startsWith('MST') || tipeUpper.startsWith('MSI')) return 'Master Stokis';
  if (tipeUpper.startsWith('STK') || tipeUpper === 'STOKIS') return 'Stokis';
  if (tipeUpper.startsWith('KARYAWAN') || tipeUpper.startsWith('ORE') || tipeUpper === 'TSIEMPLOYEE') return 'Karyawan';
  if (tipeUpper.startsWith('APPS') || tipeUpper.startsWith('ORM') || tipeUpper === 'TSIAPPS') return 'Apps';
  return '';
}

export function computeTransaction(r, priceMap, targetMonth) {
  if (!r.tanggal || !r.tanggal.startsWith(targetMonth)) return null;
  const tipe = r.tipe_customer;
  if (!tipe) return null;
  const kategori = detectCategory(tipe.toUpperCase());
  if (!kategori) return null;

  const prods = r.products || {};
  let totalNominal = 0;
  let totalBungkus = 0;
  for (const [prodName, qty] of Object.entries(prods)) {
    if (qty > 0) {
      if (prodName !== 'HU') totalBungkus += qty;
      if (priceMap[prodName]) {
        const price = kategori === 'Karyawan' ? priceMap[prodName].karyawan : priceMap[prodName].mst;
        totalNominal += (qty * price);
      }
    }
  }
  return {
    tanggal: r.tanggal,
    cabang: r.cabang,
    nama_customer: tipe,
    kategori,
    products: prods,
    total_bungkus: totalBungkus,
    total_nominal: totalNominal,
  };
}

export function aggregateSummary(transactions) {
  const map = {};
  for (const t of transactions) {
    const key = `${t.cabang}||${t.nama_customer}`;
    let g = map[key];
    if (!g) {
      g = {
        nama_customer: t.nama_customer,
        kategori: t.kategori,
        cabang: t.cabang,
        products: {},
        total_bungkus: 0,
        total_nominal: 0,
      };
      map[key] = g;
    }
    g.total_bungkus += t.total_bungkus;
    g.total_nominal += t.total_nominal;
    for (const [p, qty] of Object.entries(t.products)) {
      g.products[p] = (g.products[p] || 0) + qty;
    }
  }
  return Object.values(map).sort((a, b) => {
    if (a.cabang !== b.cabang) return a.cabang.localeCompare(b.cabang);
    return a.nama_customer.localeCompare(b.nama_customer);
  });
}

export async function handle(db, monthFilter) {
  let targetMonth = monthFilter;
  if (!targetMonth) {
    const now = new Date();
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const parts = targetMonth.split('-');
  const lastDay = new Date(parseInt(parts[0]), parseInt(parts[1]), 0).getDate();
  const lteDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
  const gteDate = `${targetMonth}-01`;

  const pricesRaw = await db.query('product_prices', {
    select: 'product_name,price_mst,price_stk'
  });
  const priceMap = {};
  for (const p of pricesRaw) {
    priceMap[p.product_name] = { mst: p.price_mst, karyawan: p.price_stk };
  }

  const rows = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal,products,jumlah',
    gte: { tanggal: gteDate },
    lte: { tanggal: lteDate },
  });

  const transactions = [];
  for (const r of rows) {
    const t = computeTransaction(r, priceMap, targetMonth);
    if (t) transactions.push(t);
  }

  return { status: 'success', data: aggregateSummary(transactions) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/rekap-belanja-backend.test.mjs`

Expected: PASS — mencetak `OK: semua tes backend rekap belanja lolos`.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/report-belanja-stokis.js tests/rekap-belanja-backend.test.mjs
git commit -m "feat: rekap belanja backend agregasi ringkasan per cabang+nama"
```

---
---

### Task 2: Frontend — render ringkasan per cabang

**Files:**
- Modify: `src/modules/reports/rekapBelanja.js`
- Test: `tests/rekap-belanja-frontend.test.mjs` (Create)

**Interfaces:**
- Consumes: data dari Task 1 — `data` = array `{nama_customer, kategori, cabang, products, total_bungkus, total_nominal}`.
- Produces (dipakai Task 3):
  - `export function groupPerCabang(items) => [{cabang, items: [...]}]` — cabang asc, nama asc; berkas yang sama.

- [ ] **Step 1: Write the failing test**

Create `tests/rekap-belanja-frontend.test.mjs`:

```js
import assert from 'node:assert/strict';
import { groupPerCabang } from '../src/modules/reports/rekapBelanja.js';

const items = [
  { cabang: 'GARUT', nama_customer: 'STK B', kategori: 'Stokis' },
  { cabang: 'BANDUNG', nama_customer: 'MST Z', kategori: 'Master Stokis' },
  { cabang: 'BANDUNG', nama_customer: 'MST A', kategori: 'Master Stokis' },
];
const s = groupPerCabang(items);
assert.equal(s.length, 2);
assert.equal(s[0].cabang, 'BANDUNG', 'cabang urut abjad');
assert.deepEqual(s[0].items.map(i => i.nama_customer), ['MST A', 'MST Z'], 'nama urut abjad');
assert.equal(s[1].cabang, 'GARUT');

console.log('OK: tes groupPerCabang lolos');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/rekap-belanja-frontend.test.mjs`

Expected: FAIL — `groupPerCabang` tidak ter-export.

- [ ] **Step 3: Add `groupPerCabang` + rewrite `renderRekapBelanja`**

In `src/modules/reports/rekapBelanja.js`:

Ganti blok `function groupByCustomer(...)` + `function renderRekapBelanja()` (baris 67–186) dengan:

```js
// Kelompokkan ringkasan per cabang (abjad), lalu customer di dalamnya (abjad nama)
export function groupPerCabang(items) {
  const map = {};
  for (const t of items) {
    const cab = t.cabang || '(TANPA CABANG)';
    if (!map[cab]) map[cab] = [];
    map[cab].push(t);
  }
  return Object.keys(map).sort().map(cab => ({
    cabang: cab,
    items: map[cab].sort((a, b) => String(a.nama_customer || '').localeCompare(String(b.nama_customer || ''))),
  }));
}

function renderRekapBelanja() {
  const thead = document.getElementById('rekap-belanja-thead');
  const tbody = document.getElementById('rekap-belanja-tbody');
  const tfoot = document.getElementById('rekap-belanja-tfoot');

  // 1. Header — Nama | Tipe | Cabang | Produk... | Total Bungkus | Total Nominal
  let headHtml = `<tr>
    <th class="px-4 py-3 text-left whitespace-nowrap">Nama</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Tipe</th>
    <th class="px-4 py-3 text-left whitespace-nowrap">Cabang</th>`;
  PRODUCT_COLS.forEach(p => {
    headHtml += `<th class="px-2 py-3 text-right whitespace-nowrap">${p}</th>`;
  });
  headHtml += `<th class="px-4 py-3 text-right whitespace-nowrap">Total Bungkus</th>
    <th class="px-4 py-3 text-right whitespace-nowrap">Total Nominal (Rp)</th></tr>`;
  thead.innerHTML = headHtml;

  // 2. Body
  const filtered = getFiltered();
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${3 + TOTAL_COLS}" class="px-4 py-8 text-center text-slate-500">Tidak ada data belanja di bulan ini.</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  const sections = groupPerCabang(filtered);
  let bodyHtml = '';
  let grandSumBungkus = 0;
  let grandSumNominal = 0;
  const grandSumProds = {};
  PRODUCT_COLS.forEach(p => grandSumProds[p] = 0);

  sections.forEach(sec => {
    const cabProds = {};
    PRODUCT_COLS.forEach(p => cabProds[p] = 0);
    let cabBungkus = 0;
    let cabNominal = 0;

    bodyHtml += `<tr class="bg-slate-800 text-white">
      <td colspan="${3 + TOTAL_COLS}" class="px-4 py-2 font-bold uppercase tracking-wider">=== CABANG: ${sec.cabang} ===</td>
    </tr>`;

    sec.items.forEach(item => {
      let namaCls = 'text-slate-700 font-bold';
      if (item.kategori === 'Master Stokis') namaCls = 'text-amber-700 font-bold';
      else if (item.kategori === 'Stokis') namaCls = 'text-blue-700 font-bold';
      else if (item.kategori === 'Karyawan') namaCls = 'text-purple-700 font-bold';
      else if (item.kategori === 'Apps') namaCls = 'text-emerald-700 font-bold';

      cabBungkus += item.total_bungkus;
      cabNominal += item.total_nominal;
      grandSumBungkus += item.total_bungkus;
      grandSumNominal += item.total_nominal;

      bodyHtml += `<tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-2 ${namaCls} whitespace-nowrap">${item.nama_customer}</td>
        <td class="px-4 py-2 whitespace-nowrap">${item.kategori}</td>
        <td class="px-4 py-2 whitespace-nowrap">${item.cabang}</td>`;

      PRODUCT_COLS.forEach(p => {
        const qty = item.products[p] || 0;
        cabProds[p] += qty;
        grandSumProds[p] += qty;
        bodyHtml += `<td class="px-2 py-2 text-right font-mono ${qty > 0 ? 'text-slate-800' : 'text-slate-300'}">${qty > 0 ? qty.toLocaleString('id-ID') : '-'}</td>`;
      });

      bodyHtml += `<td class="px-4 py-2 text-right font-bold text-slate-700 font-mono">${item.total_bungkus.toLocaleString('id-ID')}</td>
        <td class="px-4 py-2 text-right font-bold text-emerald-600 font-mono">${item.total_nominal.toLocaleString('id-ID')}</td></tr>`;
    });

    // Subtotal per cabang
    bodyHtml += `<tr class="bg-slate-100 font-bold text-sm">
      <td class="px-4 py-2 uppercase tracking-wider" colspan="3">SUBTOTAL CABANG ${sec.cabang}</td>`;
    PRODUCT_COLS.forEach(p => {
      bodyHtml += `<td class="px-2 py-2 text-right font-mono">${cabProds[p] > 0 ? cabProds[p].toLocaleString('id-ID') : '-'}</td>`;
    });
    bodyHtml += `<td class="px-4 py-2 text-right font-mono">${cabBungkus.toLocaleString('id-ID')}</td>
      <td class="px-4 py-2 text-right text-emerald-700 font-mono">${cabNominal.toLocaleString('id-ID')}</td></tr>`;
  });

  tbody.innerHTML = bodyHtml;

  // 3. Grand Total footer
  let footHtml = `<tr><td colspan="3" class="px-4 py-3 text-right uppercase tracking-wider">GRAND TOTAL KESELURUHAN</td>`;
  PRODUCT_COLS.forEach(p => {
    footHtml += `<td class="px-2 py-3 text-right font-mono">${grandSumProds[p] > 0 ? grandSumProds[p].toLocaleString('id-ID') : '-'}</td>`;
  });
  footHtml += `<td class="px-4 py-3 text-right font-bold font-mono">${grandSumBungkus.toLocaleString('id-ID')}</td>
    <td class="px-4 py-3 text-right font-bold text-emerald-700 font-mono">${grandSumNominal.toLocaleString('id-ID')}</td></tr>`;
  tfoot.innerHTML = footHtml;
}
```

Catatan: hilangkan `groupByCustomer` (tidak dipakai lagi). Biarkan `getFiltered`, `populateBranchFilter`, `loadRekapBelanja`, `initRekapBelanja` apa adanya.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/rekap-belanja-frontend.test.mjs`

Expected: PASS — mencetak `OK: tes groupPerCabang lolos`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/rekapBelanja.js tests/rekap-belanja-frontend.test.mjs
git commit -m "feat: rekap belanja tampilan ringkasan group per cabang"
```

---
---

### Task 3: Frontend — export Excel ringkasan

**Files:**
- Modify: `src/modules/reports/rekapBelanja.js` (fungsi `exportRekapBelanja`, baris 188–396)

**Interfaces:**
- Consumes: `groupPerCabang(filtered)`, `getFiltered()`, `PRODUCT_COLS` (dari Task 2 / file yang sama).
- Produces: file `.xlsx` ringkasan (tidak dipakai task lain).

- [ ] **Step 1: Replace `exportRekapBelanja`**

Ganti seluruh fungsi `exportRekapBelanja` (dari `export function exportRekapBelanja() {` sampai penutupnya) dengan:

```js
export function exportRekapBelanja() {
  if (typeof XLSX === 'undefined') {
    alert('Library Excel belum siap. Silakan refresh halaman.');
    return;
  }

  const filtered = getFiltered();
  if (filtered.length === 0) {
    alert('Tidak ada data untuk diexport.');
    return;
  }

  const branchFilter = document.getElementById('rekap-belanja-branch').value;
  const katExEl = document.getElementById('rekap-belanja-kategori');
  const kategoriFilter = katExEl ? katExEl.value : 'ALL';
  const month = document.getElementById('rekap-belanja-month').value;

  const katLabel = kategoriFilter === 'ALL' ? 'Semua' : kategoriFilter.replace(' ', '-');
  const katHeader = kategoriFilter === 'ALL' ? 'MASTER STOKIS & STOKIS' : kategoriFilter.toUpperCase();
  const cabangHeader = branchFilter === 'ALL' ? 'SEMUA CABANG' : branchFilter;
  const [yr, mo] = month.split('-');
  const BULAN_NAMES = ['','JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
  const bulanLabel = `${BULAN_NAMES[parseInt(mo)]} ${yr}`;

  const sections = groupPerCabang(filtered);
  const rows = [];

  // === HEADER ATAS ===
  rows.push(['PT TRIDAYA SINERGI INDONESIA']);
  rows.push([`REKAP BELANJA ${katHeader}`]);
  rows.push([cabangHeader]);
  rows.push([`PERIODE ${bulanLabel}`]);
  rows.push([]);

  // === HEADER KOLOM ===
  rows.push(['NAMA', 'TIPE', 'CABANG', ...PRODUCT_COLS, 'TOTAL BUNGKUS', 'TOTAL NOMINAL (Rp)']);

  const grandProds = {};
  PRODUCT_COLS.forEach(p => grandProds[p] = 0);
  let grandBungkus = 0;
  let grandNominal = 0;

  sections.forEach(sec => {
    rows.push([`=== CABANG: ${sec.cabang} ===`]);

    const cabProds = {};
    PRODUCT_COLS.forEach(p => cabProds[p] = 0);
    let cabBungkus = 0;
    let cabNominal = 0;

    sec.items.forEach(item => {
      const row = [item.nama_customer, item.kategori, item.cabang];
      PRODUCT_COLS.forEach(p => {
        const qty = item.products[p] || 0;
        cabProds[p] += qty;
        grandProds[p] += qty;
        row.push(qty || '');
      });
      row.push(item.total_bungkus);
      row.push(item.total_nominal);
      cabBungkus += item.total_bungkus;
      cabNominal += item.total_nominal;
      grandBungkus += item.total_bungkus;
      grandNominal += item.total_nominal;
      rows.push(row);
    });

    const cabSub = ['', '', `SUBTOTAL CABANG ${sec.cabang}`];
    PRODUCT_COLS.forEach(p => cabSub.push(cabProds[p] || ''));
    cabSub.push(cabBungkus);
    cabSub.push(cabNominal);
    rows.push(cabSub);
    rows.push([]);
    rows.push([]);
  });

  const grandRow = ['', '', 'GRAND TOTAL KESELURUHAN'];
  PRODUCT_COLS.forEach(p => grandRow.push(grandProds[p] || ''));
  grandRow.push(grandBungkus);
  grandRow.push(grandNominal);
  rows.push(grandRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Styling & formatting (pola lama dipertahankan)
  const numCols = 3 + PRODUCT_COLS.length + 2;
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    const cell = ws[key];
    const rowNum = parseInt(key.replace(/[^0-9]/g, ''), 10) - 1;

    if (typeof cell.v === 'number') cell.z = '#,##0';

    if (rowNum === 5) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    if (rowNum > 5 && typeof cell.v === 'string' && (cell.v.includes('GRAND TOTAL') || cell.v.includes('SUBTOTAL CABANG') || cell.v.includes('=== CABANG'))) {
      cell.s = { font: { bold: true } };
      if (cell.v.includes('=== CABANG')) {
        cell.s.fill = { fgColor: { rgb: "E2E8F0" } };
        cell.s.color = { rgb: "0F172A" };
      }
    }
  }

  rows.forEach((rData, rIdx) => {
    if (rIdx > 5 && rData[0] && String(rData[0]).includes('=== CABANG')) {
      for (let c = 0; c < numCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ c: c, r: rIdx });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "0F172A" } },
          fill: { fgColor: { rgb: "E2E8F0" } }
        };
      }
    } else if (rIdx > 5 && rData[2] && (String(rData[2]).includes('GRAND TOTAL') || String(rData[2]).includes('SUBTOTAL CABANG'))) {
      for (let c = 0; c < numCols; c++) {
        const cellRef = XLSX.utils.encode_cell({ c: c, r: rIdx });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };

        let bgColor = "F1F5F9";
        if (String(rData[2]).includes('KESELURUHAN') || String(rData[2]).includes('SUBTOTAL CABANG')) bgColor = "CBD5E1";
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: bgColor } }
        };
      }
    }
  });

  const colWidths = [];
  for (let ci = 0; ci < numCols; ci++) {
    let minWidth;
    if (ci === 0) minWidth = 32;               // NAMA
    else if (ci === 1) minWidth = 14;          // TIPE
    else if (ci === 2) minWidth = 16;          // CABANG
    else if (ci >= numCols - 2) minWidth = 16; // TOTAL
    else minWidth = 10;                        // PRODUK

    const maxContent = Math.max(
      minWidth,
      ...rows.map(r => {
        let val = r[ci] || '';
        if (typeof val === 'number') val = val.toLocaleString('id-ID');
        return String(val).length;
      })
    );
    colWidths.push({ wch: maxContent });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Belanja");

  XLSX.writeFile(wb, `Rekap_Belanja_${branchFilter}_${katLabel}_${month}.xlsx`);
}
```

- [ ] **Step 2: Verify tidak ada referensi tersisa**

Run: `node -e "const s=require('fs').readFileSync('src/modules/reports/rekapBelanja.js','utf8'); const bad=['groupByCustomer']; for (const b of bad) { if (s.includes(b)) { console.error('Masih ada referensi:', b); process.exit(1); } } console.log('OK: tidak ada referensi usang');"`

Expected: `OK: tidak ada referensi usang`.

- [ ] **Step 3: Run seluruh test frontend + backend**

Run: `node tests/rekap-belanja-frontend.test.mjs; if ($?) { node tests/rekap-belanja-backend.test.mjs }`

Expected: kedua file mencetak `OK: ...`.

- [ ] **Step 4: Commit**

```bash
git add src/modules/reports/rekapBelanja.js
git commit -m "feat: rekap belanja export excel ringkasan group per cabang"
```

---
---

### Task 4: Backend — deteksi kolom nama (`NAMA CUSTOMER`)

**Files:**
- Modify: `worker/src/routes/save-penjualan-who.js:54-61` (blok `namaPdmCol`)
- Test: `tests/save-penjualan-who.test.mjs` (Create)

**Interfaces:**
- Produces:
  - `export function findNamaColumn(headers) => number` (index kolom nama, `-1` jika tidak ada).

- [ ] **Step 1: Write the failing test**

Create `tests/save-penjualan-who.test.mjs`:

```js
import assert from 'node:assert/strict';
import { findNamaColumn } from '../worker/src/routes/save-penjualan-who.js';

assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'TANGGAL', 'NAMA CUSTOMER', 'SPS TSI']), 4, 'NAMA CUSTOMER terdeteksi');
assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'TANGGAL', 'NAMA PDM', 'SPS TSI']), 4, 'NAMA PDM tetap terdeteksi');
assert.equal(findNamaColumn(['NAMA PEMBELI CUSTOMER', 'SPS TSI']), 0, 'header mengandung NAMA+CUSTOMER');
assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'SPS TSI']), -1, 'tanpa kolom nama');

console.log('OK: tes findNamaColumn lolos');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/save-penjualan-who.test.mjs`

Expected: FAIL — `findNamaColumn` tidak ter-export.

- [ ] **Step 3: Add `findNamaColumn` + gunakan di route**

Modify `worker/src/routes/save-penjualan-who.js`:

Setelah `function parseNum(...)` (baris 25-29), tambahkan:

```js
export function findNamaColumn(headers) {
  return headers.findIndex(h => {
    const u = String(h || '').toUpperCase().trim();
    return u === 'NAMA PDM' || u === 'NAMA CUSTOMER' || (u.includes('NAMA') && (u.includes('PDM') || u.includes('CUSTOMER')));
  });
}
```

Ganti blok deteksi kolom nama (baris 54-61):

```js
  // Cari kolom NAMA PDM secara spesifik -- harus mengandung "NAMA" DAN "PDM"
  // atau tepat bernama "NAMA PDM". Hindari mencocokkan kolom lain yang ada kata "NAMA".
  const namaPdmCol = headers.findIndex(h => {
    const u = h.toUpperCase();
    return u === 'NAMA PDM' || (u.includes('NAMA') && u.includes('PDM'));
  });
```

menjadi:

```js
  // Cari kolom nama customer: "NAMA PDM" ATAU "NAMA CUSTOMER" (nama header asli sheet).
  const namaPdmCol = findNamaColumn(headers);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/save-penjualan-who.test.mjs`

Expected: PASS — mencetak `OK: tes findNamaColumn lolos`.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/save-penjualan-who.js tests/save-penjualan-who.test.mjs
git commit -m "fix: deteksi kolom nama customer (NAMA CUSTOMER) saat paste penjualan WHO"
```

---
---

### Task 5: Deployment & verifikasi live

**Files:**
- Verify only (tidak ada perubahan kode).

**Interfaces:**
- Consumes: hasil Task 1–4.

- [ ] **Step 1: Deploy worker**

Run (dari folder `worker/`, butuhkan autentikasi Cloudflare — jika tidak tersedia di environment, minta user menjalankan):

```bash
npx wrangler deploy
```

Expected: sukses deploy `api-distribusi`.

- [ ] **Step 2: Verifikasi endpoint live Sept (harus bernama)**

Run:

```powershell
$r = Invoke-WebRequest -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/report-belanja-stokis?month=2026-09" -UseBasicParsing -TimeoutSec 60
$d = $r.Content | ConvertFrom-Json
$d.data | Select-Object -First 5 cabang, nama_customer, kategori, total_bungkus, total_nominal
```

Expected: baris ringkasan bertipe object `nama_customer` berisi nama (mis. `MST M. Naufal Haidar`), satu entri per (cabang, nama), sudah unik.

- [ ] **Step 3: Verifikasi endpoint live Agustus (kode tipe, tetap ringkasan)**

Run:

```powershell
$r = Invoke-WebRequest -Uri "https://api-distribusi.distribusi-tsi.workers.dev/api/report-belanja-stokis?month=2026-08" -UseBasicParsing -TimeoutSec 60
$d = $r.Content | ConvertFrom-Json
Write-Host ("total grup: " + $d.data.Count)
$d.data | Group-Object cabang | ForEach-Object { "{0}: {1} grup" -f $_.Name, $_.Count }
```

Expected: data ringkasan per cabang; `nama_customer` berupa kode (`MST`, `STK`, dst). Pastikan `$d.data.Count` jauh lebih kecil dari jumlah transaksi (≈2787) karena sudah diagregasi.

- [ ] **Step 4: Deploy frontend & cek layar**

Deploy frontend (Pages project `distribusidanpenjualantsi` — via Git push atau `npx wrangler pages deploy .`, sesuai alur tim; tanpa kredensial minta user deploy).

Setelah deploy, buka menu Rekap Belanja:
1. Bulan `2026-09` → header cabang (`=== CABANG: BANDUNG ===` dst), baris customer ber-nama, subtotal tiap cabang, grand total.
2. Filter Cabang satu cabang → hanya section itu.
3. Filter Tipe `Master Stokis` → hanya grup Master Stokis.
4. Tombol Export → file Excel terbuka, kolom `NAMA | TIPE | CABANG`, subtotal cabang & grand total benar.

- [ ] **Step 5: Verifikasi penyimpanan nama baru**

Test di lingkungan yang bisa paste data: paste baris penjualan WHO dengan header kolom nama `NAMA CUSTOMER` (contoh dari sheet) → cek di DB: `tipe_customer` tersimpan seperti `MST M. Naufal Haidar` (bukan cuma `MST`).