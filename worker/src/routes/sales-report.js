import { CONFIG, toDateStr, filterBranchesByWHP } from '../config.js';

export async function handle(db, dayFilter, filterMonth, startMonth, whp) {
  let gte, lte;

  if (filterMonth) {
    const parts = filterMonth.split('-');
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
    gte = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    lte = toDateStr(new Date(y, m + 1, 0));
  } else if (startMonth) {
    gte = `${startMonth}-01`;
    lte = toDateStr(new Date());
  } else {
    const now = new Date();
    gte = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    lte = toDateStr(now);
  }

  const rawRows = await db.query('penjualan_who', {
    select: 'cabang,tanggal,jumlah',
    gte: { tanggal: gte },
    lte: { tanggal: lte },
  });

  // Normalisasi cabang (trim) & filter hari-dalam-minggu (dayFilter: 0=Minggu..6=Sabtu, -1=semua)
  const rows = [];
  for (const r of rawRows) {
    const cabang = String(r.cabang || '').trim().toUpperCase();
    if (!cabang) continue;
    if (dayFilter !== -1 && dayFilter !== undefined && dayFilter !== null) {
      const d = new Date(r.tanggal + 'T00:00:00');
      if (d.getDay() !== dayFilter) continue;
    }
    rows.push({ ...r, cabang });
  }

  // Daftar exclude khusus laporan ini (substring match, TIDAK termasuk BANYUMAS) --
  // beda dari CONFIG.IGNORE_BRANCHES yang dipakai modul lain, port dari Sales.js:183-186.
  const cabangSet = new Set();
  for (const r of rows) {
    if (!CONFIG.IGNORE_BRANCHES_REPORT.some(ignore => r.cabang.includes(ignore))) cabangSet.add(r.cabang);
  }
  const cabangList = filterBranchesByWHP([...cabangSet].sort(), whp);

  const pivot = {};
  for (const r of rows) {
    if (!cabangList.includes(r.cabang)) continue;
    const d = r.tanggal;
    if (!pivot[d]) pivot[d] = {};
    pivot[d][r.cabang] = (pivot[d][r.cabang] || 0) + (r.jumlah || 0);
  }

  const result = [];
  const sortedDates = Object.keys(pivot).sort();
  for (const date of sortedDates) {
    const row = { date };
    let grandTotal = 0;
    for (const c of cabangList) {
      const val = pivot[date][c] || 0;
      row[c] = val;
      grandTotal += val;
    }
    row.grandTotal = grandTotal;
    result.push(row);
  }

  return {
    status: 'success',
    branches: cabangList,
    rows: result,
  };
}
