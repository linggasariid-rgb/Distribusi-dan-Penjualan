import { CONFIG } from '../config.js';

export async function months(db) {
  const rows = await db.query('penjualan_who', {
    select: 'tanggal',
    order: 'tanggal.asc',
  });

  const monthSet = new Set();
  for (const r of rows) {
    if (r.tanggal) {
      monthSet.add(r.tanggal.slice(0, 7));
    }
  }
  return { status: 'success', data: [...monthSet].sort() };
}

export async function data(db, filterMonth) {
  let targetMonth;
  if (filterMonth) {
    targetMonth = filterMonth;
  } else {
    const now = new Date();
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const rows = await db.query('penjualan_who', {
    select: 'tanggal,jumlah,products',
    gte: { tanggal: `${targetMonth}-01` },
    lte: { tanggal: `${targetMonth}-31` },
  });

  const totals = {};
  const productKeys = Object.keys(CONFIG.PRODUCT_INFO).filter(p => p !== 'HU');

  for (const p of productKeys) totals[p] = 0;

  for (const r of rows) {
    if (!r.tanggal || !r.tanggal.startsWith(targetMonth)) continue;
    const prods = r.products || {};
    for (const p of productKeys) {
      totals[p] += (prods[p] || 0);
    }
  }

  const ranking = Object.entries(totals)
    .map(([product, total]) => ({ product, total }))
    .sort((a, b) => b.total - a.total);

  return { status: 'success', data: ranking };
}
