import { CONFIG } from '../config.js';

async function getLatestBizPeriod(db) {
  // Urutkan by created_at, BUKAN by nama periode -- nama periode adalah teks bebas
  // (mis. "March-2025", atau "unknown" kalau gagal terbaca), urutan abjadnya tidak
  // mencerminkan urutan waktu sama sekali (mis. "unknown" > "March-2025" secara abjad
  // padahal bukan periode yang lebih baru).
  const rows = await db.query('biz_stock', {
    select: 'periode,created_at',
    order: 'created_at.desc',
    limit: 1,
  });
  return rows.length > 0 ? rows[0].periode : null;
}

function getVal(products, key) {
  if (!products) return 0;
  const v = products[key];
  if (v === undefined || v === null || v === '' || v === '-') return 0;
  return parseInt(v) || 0;
}

function sumProducts(...productObjs) {
  const sums = {};
  for (const obj of productObjs) {
    if (!obj) continue;
    for (const [k, v] of Object.entries(obj)) {
      sums[k] = (sums[k] || 0) + (parseInt(v) || 0);
    }
  }
  return sums;
}

function compare(bizProducts, stockProducts, productCols) {
  const details = [];
  let totalSelisih = 0;
  for (const pc of productCols) {
    const bizVal = getVal(bizProducts, pc.bizName);
    const stockVal = getVal(stockProducts, pc.internalName);
    const selisih = bizVal - stockVal;
    if (Math.abs(selisih) > 0.1) {
      totalSelisih += Math.abs(selisih);
      details.push({
        produk: pc.bizName,
        biz: bizVal.toLocaleString('id-ID'),
        excel: stockVal.toLocaleString('id-ID'),
        selisih: selisih.toLocaleString('id-ID'),
      });
    }
  }
  return { details, totalSelisih };
}

const BANDUNG_BIZ_NAMES = ['GUDANG BDG', 'GUDANG BANDUNG', 'GDG BANDUNG', 'WHP BANDUNG'];

export async function handle(db) {
  try {
    const period = await getLatestBizPeriod(db);
    const stockRows = await db.query('stock', { select: 'cabang,products' });
    const bizRows = await db.query('biz_stock', {
      select: 'cabang,products,periode',
      eq: { periode: period },
    });

    const productCols = Object.entries(CONFIG.BIZ_PRODUCT_MAP).map(([bizName, internalName]) => ({ bizName, internalName }));

    // Pisahkan baris normal dari baris Tasikmalaya/WHP Bandung yang perlu dikonsolidasi --
    // port dari ControlPoint.js:81-116 (GAS legacy).
    const stockByBranch = {};
    let tasikStock = null, whpTasikStock = null, whpBandungStock = null;
    for (const r of stockRows) {
      const cabang = r.cabang;
      if (cabang === 'TASIKMALAYA') tasikStock = r.products;
      else if (cabang === 'WHP TASIKMALAYA' || cabang.includes('WHP TASIK')) whpTasikStock = r.products;
      else if (cabang.includes('WHP BANDUNG')) whpBandungStock = r.products;
      else stockByBranch[cabang] = r.products || {};
    }

    let tasikBiz = null, bandungBiz = null;
    const bizByBranch = {};
    for (const biz of bizRows) {
      const cabang = biz.cabang;
      if (cabang === 'TASIKMALAYA') tasikBiz = biz.products;
      else if (cabang.includes('TASIK')) continue; // "TAMPUNGAN TASIK" dkk -- bukan Tasikmalaya utama
      else if (BANDUNG_BIZ_NAMES.includes(cabang)) bandungBiz = biz.products;
      else bizByBranch[cabang] = biz.products;
    }

    const report = [];
    for (const [cabang, bizProducts] of Object.entries(bizByBranch)) {
      const stockProds = stockByBranch[cabang];
      if (!stockProds) continue;
      const { details, totalSelisih } = compare(bizProducts, stockProds, productCols);
      report.push({ cabang, status: details.length === 0 ? 'MATCH' : 'MISMATCH', totalSelisih, details });
    }

    // Konsolidasi Tasikmalaya: BIZ[TASIKMALAYA] vs STOCK[TASIKMALAYA] + STOCK[WHP TASIKMALAYA]
    if (tasikBiz || tasikStock || whpTasikStock) {
      const combinedStock = sumProducts(tasikStock, whpTasikStock);
      const { details, totalSelisih } = compare(tasikBiz, combinedStock, productCols);
      report.push({
        cabang: 'KONSOLIDASI WHP & WHO TASIKMALAYA',
        status: details.length === 0 ? 'MATCH' : 'MISMATCH',
        totalSelisih,
        details,
      });
    }

    // Konsolidasi Bandung: BIZ[GUDANG BANDUNG] vs STOCK[WHP BANDUNG]
    if (bandungBiz || whpBandungStock) {
      const { details, totalSelisih } = compare(bandungBiz, whpBandungStock, productCols);
      report.push({
        cabang: 'WHP BANDUNG',
        status: details.length === 0 ? 'MATCH' : 'MISMATCH',
        totalSelisih,
        details,
      });
    }

    return report;
  } catch (err) {
    return { error: err.message };
  }
}
