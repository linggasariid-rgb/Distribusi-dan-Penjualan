import { CONFIG, toDateStr, filterBranchesByWHP } from '../config.js';

const MONTH_ABBR_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

function isIgnoredBranch(cabang) {
  return CONFIG.IGNORE_BRANCHES.some(ignore => cabang.includes(ignore));
}

// Alias tipe customer dari data lama (ORE/ORM/TsiEmployee/TsiApps) ke kode kanonik.
// Port dari Sales.js:494-498 (GAS legacy) -- dicek sebelum di-uppercase karena
// nilai lama tersimpan mixed-case ("TsiEmployee").
function mapTipe(tipe) {
  if (tipe === 'ORE' || tipe === 'TsiEmployee') return 'KARYAWAN';
  if (tipe === 'ORM' || tipe === 'TsiApps') return 'TSIAPPS';
  return tipe.toUpperCase();
}

function snapshotLabel(d) {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_ABBR_ID[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

export async function handle(db, whp, currDateStr, prevDateStr, backdateStr) {
  const now = new Date();

  const currDate = currDateStr ? new Date(currDateStr) : now;
  const currYear = currDate.getFullYear();
  const currMon = currDate.getMonth();
  const currDayNum = currDate.getDate();

  const prevDate = prevDateStr ? new Date(prevDateStr) : new Date(currYear, currMon - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMon = prevDate.getMonth();

  const backDate = backdateStr ? new Date(backdateStr) : currDate;
  const snapDay = backDate.getDate();

  // 2 tanggal snapshot (backDate, M-1 relatif ke backDate) dengan day yang sama
  // (di-clamp ke akhir bulan kalau bulan itu lebih pendek).
  const snapDates = [];
  for (let sm = 0; sm < 2; sm++) {
    let m = backDate.getMonth() - sm;
    let y = backDate.getFullYear();
    if (m < 0) { m += 12; y--; }
    const maxD = new Date(y, m + 1, 0).getDate();
    const d = Math.min(snapDay, maxD);
    snapDates.push(new Date(y, m, d));
  }

  const currStart = toDateStr(new Date(currYear, currMon, 1));
  const currEnd = toDateStr(currDate);

  // Potong bulan lalu sampai hari ke-currDayNum yang sama (apple-to-apple), bukan sebulan penuh.
  const prevMonthLastDay = new Date(prevYear, prevMon + 1, 0).getDate();
  const prevCutoffDay = Math.min(currDayNum, prevMonthLastDay);
  const prevStart = toDateStr(new Date(prevYear, prevMon, 1));
  const prevEnd = toDateStr(new Date(prevYear, prevMon, prevCutoffDay));

  const currRows = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal,jumlah',
    gte: { tanggal: currStart },
    lte: { tanggal: currEnd },
  });

  const prevRows = await db.query('penjualan_who', {
    select: 'cabang,tipe_customer,tanggal,jumlah',
    gte: { tanggal: prevStart },
    lte: { tanggal: prevEnd },
  });

  const allCabang = [...new Set([
    ...currRows.map(r => r.cabang),
    ...prevRows.map(r => r.cabang),
  ].filter(c => c && !isIgnoredBranch(c)))].sort();
  const cabangList = filterBranchesByWHP(allCabang, whp);

  function aggregate(rows) {
    const byCabang = {};
    for (const c of cabangList) byCabang[c] = { stokis: 0, masterStokis: 0, karyawan: 0, tsiApps: 0, msi: 0 };
    for (const r of rows) {
      if (!cabangList.includes(r.cabang)) continue;
      const tipe = mapTipe((r.tipe_customer || '').trim());
      const val = r.jumlah || 0;
      const entry = byCabang[r.cabang];
      if (tipe === 'MST') entry.masterStokis += val;
      else if (tipe === 'STK') entry.stokis += val;
      else if (tipe === 'KARYAWAN') entry.karyawan += val;
      else if (tipe === 'TSIAPPS') entry.tsiApps += val;
      else if (tipe === 'MSI') entry.msi += val;
    }
    return cabangList.map(c => {
      const d = byCabang[c];
      const total = d.stokis + d.masterStokis + d.karyawan + d.tsiApps + d.msi;
      return { warehouse: c, cabang: c, ...d, total };
    });
  }

  const currentMonthData = aggregate(currRows);
  const previousMonthData = aggregate(prevRows);

  const currTotal = currentMonthData.reduce((s, r) => s + r.total, 0);
  const prevTotal = previousMonthData.reduce((s, r) => s + r.total, 0);
  const delta = currTotal - prevTotal;
  const growthPct = prevTotal > 0 ? Math.round((delta / prevTotal) * 10000) / 100 : 0;

  // Snapshot per tanggal spesifik (bukan seluruh hari bulan berjalan) -- satu query per tanggal.
  const dateSnapshots = [];
  let todayTotal = 0;
  for (let i = 0; i < snapDates.length; i++) {
    const dateKey = toDateStr(snapDates[i]);
    const dayRows = await db.query('penjualan_who', {
      select: 'cabang,tipe_customer,tanggal,jumlah',
      eq: { tanggal: dateKey },
    });
    const snapData = aggregate(dayRows.filter(r => cabangList.includes(r.cabang)));
    dateSnapshots.push({ date: snapshotLabel(snapDates[i]), data: snapData });
    if (i === 0) todayTotal = snapData.reduce((s, r) => s + r.total, 0);
  }

  // Daily comparison (current month vs previous month same days)
  const dailyComparison = [];
  const maxDay = Math.min(currDayNum, prevMonthLastDay);
  for (let d = 1; d <= maxDay; d++) {
    const dayStrCurr = `${currYear}-${String(currMon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayStrPrev = `${prevYear}-${String(prevMon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const currVal = currRows.filter(r => r.tanggal === dayStrCurr && cabangList.includes(r.cabang)).reduce((s, r) => s + (r.jumlah || 0), 0);
    const prevVal = prevRows.filter(r => r.tanggal === dayStrPrev && cabangList.includes(r.cabang)).reduce((s, r) => s + (r.jumlah || 0), 0);
    dailyComparison.push({
      date: `${String(d).padStart(2, '0')}/${String(currMon + 1).padStart(2, '0')}`,
      current: currVal,
      previous: prevVal,
      delta: currVal - prevVal,
    });
  }

  return {
    status: 'success',
    data: {
      currentMonth: { label: `${currMon + 1}/${currYear}`, data: currentMonthData },
      previousMonth: { label: `${prevMon + 1}/${prevYear}`, data: previousMonthData },
      kpis: { delta, growthPct, currentTotal: currTotal, previousTotal: prevTotal, currentDays: currDayNum, todayTotal },
      dateSnapshots,
      branches: cabangList,
      dailyComparison,
    },
  };
}
