import { CONFIG, toDateStr } from '../config.js';

function isIgnoredBranch(cabang) {
  return CONFIG.IGNORE_BRANCHES.some(ignore => cabang.includes(ignore));
}

export async function handle(db, whp, selWhp, branch) {
  const now = new Date();
  const todayStr = toDateStr(now);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  let lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthEndStr = toDateStr(lastMonthEnd);

  const firstOfMonth = `${year}-${month}-01`;

  // Gabungkan pembatasan WHP milik user (whp) dengan pilihan dropdown (selWhp/branch di UI) --
  // hasil akhirnya irisan dari keduanya, bukan salah satu saja.
  let allowedBranches = whp && whp !== 'ALL' ? (CONFIG.WHP_MAPPING[whp] || []) : null;
  if (selWhp && selWhp !== 'ALL') {
    const selBranches = CONFIG.WHP_MAPPING[selWhp] || [];
    allowedBranches = allowedBranches ? allowedBranches.filter(b => selBranches.includes(b)) : selBranches;
  }
  if (branch && branch !== 'ALL') {
    allowedBranches = allowedBranches ? (allowedBranches.includes(branch) ? [branch] : []) : [branch];
  }

  const whoRows = await db.query('penjualan_who', {
    select: 'bulan,cabang,tipe_customer,tanggal,jumlah,products',
    gte: { tanggal: firstOfMonth },
    lte: { tanggal: todayStr },
  });

  const whoLastMonth = await db.query('penjualan_who', {
    select: 'bulan,cabang,tipe_customer,tanggal,jumlah',
    gte: { tanggal: `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01` },
    lte: { tanggal: lastMonthEndStr },
  });

  let monthly = 0, lastMonthTotal = 0;
  let dailyMap = {};

  const cabangSet = new Set();
  for (const r of whoRows) {
    const c = r.cabang;
    if (isIgnoredBranch(c)) continue;
    if (allowedBranches && !allowedBranches.includes(c)) continue;
    cabangSet.add(c);
    monthly += r.jumlah || 0;
    dailyMap[r.tanggal] = (dailyMap[r.tanggal] || 0) + (r.jumlah || 0);
  }

  for (const r of whoLastMonth) {
    const c = r.cabang;
    if (isIgnoredBranch(c)) continue;
    if (allowedBranches && !allowedBranches.includes(c)) continue;
    lastMonthTotal += r.jumlah || 0;
  }

  // Selisih absolut (Bks), bukan persentase -- konsisten dengan definisi lama.
  const growth = monthly - lastMonthTotal;

  // "Hari ini" = total pada tanggal terakhir yang benar-benar ada transaksinya
  // bulan ini (fallback kalau input hari ini belum masuk), bukan strict tanggal kalender.
  const daysWithData = Object.keys(dailyMap).sort();
  const today = daysWithData.length ? dailyMap[daysWithData[daysWithData.length - 1]] : 0;

  const allCabang = [...cabangSet].sort();

  const ranking = [];
  const branchTotals = {};
  for (const r of whoRows) {
    const c = r.cabang;
    if (!allCabang.includes(c)) continue;
    branchTotals[c] = (branchTotals[c] || 0) + (r.jumlah || 0);
  }
  for (const [branch, total] of Object.entries(branchTotals)) {
    ranking.push({ branch, total });
  }
  ranking.sort((a, b) => b.total - a.total);

  // Grafik tren: hari-hari yang ADA transaksinya bulan ini, maksimal 15 titik terakhir
  // (bisa <15 di awal bulan) -- tidak diisi 0 palsu untuk hari yang belum berjalan.
  const recentDays = daysWithData.slice(-15);
  const dailyLabels = recentDays.map(k => {
    const d = new Date(k + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const dailyValues = recentDays.map(k => dailyMap[k]);

  const distRows = await db.query('distribusi', {
    select: 'gudang,jumlah',
    gte: { tanggal: firstOfMonth },
    lte: { tanggal: todayStr },
  });

  let distBDG = 0, distTSM = 0;
  for (const r of distRows) {
    const g = (r.gudang || '').toUpperCase();
    if (g.includes('BANDUNG')) distBDG += r.jumlah || 0;
    if (g.includes('TASIK')) distTSM += r.jumlah || 0;
  }

  const penerimaanRows = await db.query('penerimaan', {
    select: 'gudang,jumlah',
    gte: { tanggal: firstOfMonth },
    lte: { tanggal: todayStr },
  });

  let recBDG = 0, recTSM = 0;
  for (const r of penerimaanRows) {
    const g = (r.gudang || '').toUpperCase();
    if (g.includes('BANDUNG')) recBDG += r.jumlah || 0;
    if (g.includes('TASIK')) recTSM += r.jumlah || 0;
  }

  return {
    status: 'success',
    data: {
      kpis: {
        lastMonth: lastMonthTotal,
        monthly,
        growth,
        today,
        distBDG,
        distTSM,
        recBDG,
        recTSM,
      },
      ranking,
      dailyTrend: { labels: dailyLabels, values: dailyValues },
    },
  };
}
