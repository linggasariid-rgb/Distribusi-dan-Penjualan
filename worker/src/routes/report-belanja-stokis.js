import { toDateStr, CONFIG } from '../config.js';

export async function handle(db, monthFilter) {
  // 1. Dapatkan tanggal rentang pencarian
  let targetMonth = monthFilter;
  if (!targetMonth) {
    const now = new Date();
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const parts = targetMonth.split('-');
  const lastDay = new Date(parseInt(parts[0]), parseInt(parts[1]), 0).getDate();
  const lteDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
  const gteDate = `${targetMonth}-01`;

    // 2. Tarik harga produk dari database (price_stk akan kita pakai untuk Karyawan)
    const pricesRaw = await db.query('product_prices', {
      select: 'product_name,price_mst,price_stk'
    });
    const priceMap = {};
    for (const p of pricesRaw) {
      priceMap[p.product_name] = { mst: p.price_mst, karyawan: p.price_stk };
    }

  // 3. Tarik data penjualan WHO
  const rows = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal,products,jumlah',
    gte: { tanggal: gteDate },
    lte: { tanggal: lteDate },
  });

  const transactions = [];

  for (const r of rows) {
    if (!r.tanggal || !r.tanggal.startsWith(targetMonth)) continue;
    if (!r.tipe_customer) continue;

    const tipeUpper = r.tipe_customer.toUpperCase();
    
    // Gabungkan MST/MSI jadi "Master Stokis", STK tetap "Stokis"
    // ORE/Karyawan jadi "Karyawan", ORM/TsiApps jadi "Apps"
    let category = '';
    let isMst = false;

    if (tipeUpper.startsWith('MST') || tipeUpper.startsWith('MSI')) {
      category = 'Master Stokis';
      isMst = true;
    } else if (tipeUpper.startsWith('STK') || tipeUpper === 'STOKIS') {
      category = 'Stokis';
    } else if (tipeUpper.startsWith('KARYAWAN') || tipeUpper.startsWith('ORE') || tipeUpper === 'TSIEMPLOYEE') {
      category = 'Karyawan';
    } else if (tipeUpper.startsWith('APPS') || tipeUpper.startsWith('ORM') || tipeUpper === 'TSIAPPS') {
      category = 'Apps';
    }

    if (!category) continue; // Skip tipe lain yang tidak dikenal

    const prods = r.products || {};
    let totalNominal = 0;
    let totalBungkus = 0;
    
    // Hitung nominal dan bungkus per produk
    for (const [prodName, qty] of Object.entries(prods)) {
      if (qty > 0) {
        if (prodName !== 'HU') {
          totalBungkus += qty;
        }
        if (priceMap[prodName]) {
          let price = 0;
          if (category === 'Master Stokis' || category === 'Stokis' || category === 'Apps') price = priceMap[prodName].mst;
          else if (category === 'Karyawan') price = priceMap[prodName].karyawan; // Mengambil dari kolom price_stk
          
          totalNominal += (qty * price);
        }
      }
    }

    transactions.push({
      tanggal: r.tanggal,
      cabang: r.cabang,
      nama_customer: r.tipe_customer, // simpan nama asli
      kategori: category,
      products: prods,
      total_bungkus: totalBungkus, // pakai hitungan manual tanpa HU
      total_nominal: totalNominal
    });
  }

  // Sort: Terbaru di atas, lalu abjad cabang
  transactions.sort((a, b) => {
    if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
    return a.cabang.localeCompare(b.cabang);
  });

  return { status: 'success', data: transactions };
}
