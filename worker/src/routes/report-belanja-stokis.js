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
        const price = (kategori === 'Karyawan' && prodName !== 'HU') ? priceMap[prodName].karyawan : priceMap[prodName].mst;
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
    if ((a.cabang || '') !== (b.cabang || '')) return (a.cabang || '').localeCompare(b.cabang || '');
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