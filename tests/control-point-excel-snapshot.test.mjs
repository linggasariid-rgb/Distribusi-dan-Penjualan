import assert from 'node:assert/strict';
import { handle as handleSaveStock } from '../worker/src/routes/save-stock.js';
import { handle as handleControlPoint } from '../worker/src/routes/control-point.js';

const PRODUCT_COUNT = 20;

// ── save-stock: upsert harus menulis snapshot excel_products = nilai paste ──
{
  const writes = [];
  const db = {
    async request(method, table, payload) {
      writes.push({ method, table, payload });
      return { status: 'success' };
    },
  };

  const row = Array.from({ length: PRODUCT_COUNT }, (_, i) => (i + 1) * 10);
  const res = await handleSaveStock(db, { data: [row] });

  assert.equal(res.status, 'success');
  assert.equal(writes.length, 1, 'satu baris -> satu upsert');
  const w = writes[0];
  assert.equal(w.method, 'POST');
  assert.equal(w.table, 'stock');
  assert.equal(w.payload.onConflict, 'cabang');
  assert.equal(w.payload.data.cabang, 'WHP BANDUNG', 'baris pertama = WHP BANDUNG (STOCK_SHEET_ROW_ORDER)');
  assert.equal(w.payload.data.products['SPS TSI'], 10);
  assert.deepEqual(w.payload.data.excel_products, w.payload.data.products, 'excel_products = snapshot pemetaan posisional');
}

// ── control-point: kolom EXCEL harus pakai excel_products (snapshot), bukan products live ──
{
  function fakeDb(stockRows, bizRows) {
    return {
      async query(table, opts) {
        if (table === 'stock') return stockRows;
        if (table === 'biz_stock') {
          if (opts.eq && opts.eq.periode) return bizRows;
          return [{ periode: 'current', created_at: '2026-09-24T00:00:00Z' }];
        }
        return [];
      },
    };
  }

  const stockRows = [
    { cabang: 'BANDUNG',      products: { 'SPS TSI': 40, 'SKM TSI': 90 }, excel_products: { 'SPS TSI': 30, 'SKM TSI': 80 } },
    { cabang: 'SUKABUMI',     products: { 'SPS TSI': 500 }, excel_products: null },
    { cabang: 'TASIKMALAYA',  products: { 'SKM TSI': 200 }, excel_products: { 'SKM TSI': 190 } },
    { cabang: 'WHP TASIKMALAYA', products: { 'SKM TSI': 100 }, excel_products: { 'SKM TSI': 90 } },
    { cabang: 'WHP BANDUNG',  products: { 'SPS TSI': 10 }, excel_products: { 'SPS TSI': 10 } },
  ];
  const bizRows = [
    { cabang: 'BANDUNG', products: { 'Sin Platinum Special': 30, 'Sin Kujang Mas': 80 } },
    { cabang: 'SUKABUMI', products: { 'Sin Platinum Special': 499 } },
    { cabang: 'TASIKMALAYA', products: { 'Sin Kujang Mas': 300 } },
    { cabang: 'WHP BANDUNG', products: { 'Sin Platinum Special': 10 } },
  ];

  const report = await handleControlPoint(fakeDb(stockRows, bizRows));
  assert.equal(typeof report, 'object');

  const bandung = report.find(r => r.cabang === 'BANDUNG');
  assert.equal(bandung.status, 'MATCH', 'EXCEL pakai excel_products 30 vs BIZ 30 -> MATCH (live 40 tidak boleh dipakai)');

  const sukabumi = report.find(r => r.cabang === 'SUKABUMI');
  assert.equal(sukabumi.status, 'MISMATCH', 'tanpa excel_products -> fallback products 500 vs BIZ 499');
  assert.equal(sukabumi.details[0].selisih, '-1');

  const tasik = report.find(r => r.cabang === 'KONSOLIDASI WHP & WHO TASIKMALAYA');
  assert.equal(tasik.status, 'MISMATCH', 'konsolidasi pakai snapshot (190+90=280 vs BIZ 300)');
  assert.equal(tasik.details[0].selisih, '20');
}

console.log('OK: semua tes snapshot EXCEL control-point lolos');