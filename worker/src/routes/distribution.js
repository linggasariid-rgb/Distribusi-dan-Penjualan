import { CONFIG, toDateStr, calculateWorkDays } from '../config.js';

function isIgnoredBranch(cabang) {
  return CONFIG.IGNORE_BRANCHES.some(ignore => cabang.includes(ignore));
}

export async function handle(db, whp) {
  const now = new Date();
  const todayStr = toDateStr(now);
  const WINDOW_DAYS = 15; // today - 14 hari, inklusif = 15 hari kalender (port dari Distribution.js:37-38)
  const startDate = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WINDOW_DAYS - 1)));

  const salesRows = await db.query('penjualan_who', {
    select: 'cabang,tanggal,jumlah,products',
    gte: { tanggal: startDate },
    lte: { tanggal: todayStr },
  });

  const stockRows = await db.query('stock', {
    select: 'cabang,products',
  });

  const stockByBranch = {};
  for (const r of stockRows) {
    stockByBranch[r.cabang] = r.products || {};
  }

  const branches = await db.query('branches', {
    select: 'name,whp,is_full_time,lead_time,is_active',
  });

  const branchMap = {};
  for (const b of branches) {
    branchMap[b.name] = b;
  }

  const productKeys = Object.keys(CONFIG.PRODUCT_INFO);
  const productInfo = CONFIG.PRODUCT_INFO;

  // Kumpulkan nilai penjualan PER TRANSAKSI (bukan langsung dijumlah) per cabang+produk,
  // supaya filter outlier bisa dijalankan sebelum dijumlahkan -- port dari Distribution.js:78-107.
  const dailySales = {};
  for (const r of salesRows) {
    const cabang = r.cabang;
    if (isIgnoredBranch(cabang)) continue;
    if (!dailySales[cabang]) dailySales[cabang] = {};
    const prods = r.products || {};
    for (const p of productKeys) {
      if (!dailySales[cabang][p]) dailySales[cabang][p] = [];
      dailySales[cabang][p].push(prods[p] || 0);
    }
  }

  const result = {};
  const specialRoundUp = CONFIG.SPECIAL_ROUND_UP || [];
  const endDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const [cabang, prodLists] of Object.entries(dailySales)) {
    const branchInfo = branchMap[cabang];
    if (!branchInfo) continue;
    if (whp && whp !== 'ALL' && branchInfo.whp !== whp.replace('WHP ', '')) continue;

    const pembagi = calculateWorkDays(cabang, endDateObj, WINDOW_DAYS);
    const produk = {};

    for (const p of productKeys) {
      const currentStock = stockByBranch[cabang]?.[p] || 0;
      const ds = prodLists[p] || [];
      let salesTotal = 0;
      if (ds.length >= 3) {
        const sorted = ds.slice().sort((a, b) => a - b);
        const highest = sorted[sorted.length - 1];
        const rest = sorted.slice(0, -1);
        const restSum = rest.reduce((s, v) => s + v, 0);
        const restAvg = restSum / rest.length;
        salesTotal = highest > restAvg * 3 ? restSum : ds.reduce((s, v) => s + v, 0);
      } else {
        salesTotal = ds.reduce((s, v) => s + v, 0);
      }
      produk[p] = { salesTotal, currentStock };
    }

    result[cabang] = { nama: cabang, pembagi, produk };
  }

  // WHP stock data (stok gudang pusat) -- cocokkan via CONFIG.WHP_MAPPING, bukan prefix string,
  // supaya konsisten dengan cara migrate.js menyimpan baris WHP di tabel stock.
  const whpStockData = {};
  for (const [cabang, prods] of Object.entries(stockByBranch)) {
    const whpKey = Object.keys(CONFIG.WHP_MAPPING).find(w => cabang.includes(w));
    if (whpKey) whpStockData[whpKey] = prods;
  }
  const filteredWhpStockData = whp && whp !== 'ALL'
    ? (whpStockData[whp] ? { [whp]: whpStockData[whp] } : {})
    : whpStockData;

  const whpMapping = {};
  for (const [whpName, cabangs] of Object.entries(CONFIG.WHP_MAPPING)) {
    whpMapping[whpName] = cabangs;
  }

  return {
    status: 'success',
    data: {
      result,
      productList: productKeys,
      productInfo,
      whpMapping,
      specialRoundUp,
      whpStockData: filteredWhpStockData,
      leadTime: CONFIG.LEAD_TIME,
    },
  };
}
