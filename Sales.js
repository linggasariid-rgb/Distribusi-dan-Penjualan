function getBestProductsData(filterMonth) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Update-Penjualan WHO");
    if (!sheet) throw new Error("Sheet 'Update-Penjualan WHO' tidak ditemukan.");

    const data = getSheetDataCached("Update-Penjualan WHO");
    const headers = data[0].map(h => String(h).trim().toUpperCase());
    const rows = data.slice(1);

    if (rows.length === 0) {
      return { status: "success", data: [] };
    }

    const productKeys = Object.keys(CONFIG.PRODUCT_INFO);
    const productCols = {};

    headers.forEach((h, idx) => {
      const clean = h.replace(/\s+/g, '');
      for (const p of productKeys) {
        if (p === 'HU') continue;
        const pClean = p.replace(/\s+/g, '').toUpperCase();
        const alias = CONFIG.PRODUCT_INFO[p].alias;
        const aliasClean = alias ? alias.replace(/\s+/g, '').toUpperCase() : '';
        if (clean === pClean || (alias && clean === aliasClean)) {
          productCols[p] = idx;
          break;
        }
      }
    });

    const tglIdx = headers.findIndex(h => h.replace(/\s+/g, '') === 'TANGGAL');

    // Parse filter month
    let filterDate;
    if (filterMonth) {
      const parts = filterMonth.split('-');
      filterDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    } else {
      filterDate = new Date();
    }

    const totals = {};
    Object.keys(productCols).forEach(p => totals[p] = 0);

    rows.forEach(row => {
      if (tglIdx === -1 || !isSameMonth(row[tglIdx], filterDate)) return;
      Object.keys(productCols).forEach(p => {
        totals[p] += cleanNum(row[productCols[p]]);
      });
    });

    const ranking = Object.keys(totals)
      .map(p => ({ product: p, total: totals[p] }))
      .sort((a, b) => b.total - a.total);

    return { status: "success", data: ranking };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getBestProductsMonths() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Update-Penjualan WHO");
    if (!sheet) throw new Error("Sheet 'Update-Penjualan WHO' tidak ditemukan.");

    const data = getSheetDataCached("Update-Penjualan WHO");
    const headers = data[0].map(h => String(h).trim().toUpperCase());
    const tglIdx = headers.findIndex(h => h.replace(/\s+/g, '') === 'TANGGAL');
    if (tglIdx === -1) return { status: "success", data: [] };

    const rows = data.slice(1);
    const monthSet = {};

    rows.forEach(row => {
      const raw = row[tglIdx];
      if (!raw) return;
      let d;
      if (raw instanceof Date) {
        d = raw;
      } else {
        const s = String(raw).trim();
        if (s.includes('/')) {
          const p = s.split('/');
          d = new Date(p[2], p[1] - 1, 1);
        } else {
          d = new Date(s);
        }
      }
      if (d instanceof Date && !isNaN(d)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthSet[key] = true;
      }
    });

    const months = Object.keys(monthSet).sort();
    return { status: "success", data: months };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function parseTglCell(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  const s = String(raw).trim();
  if (s.includes('/')) {
    const p = s.split('/');
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getSalesDailyReport(dayFilter, filterMonth, startMonth, userWHP) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Update-Penjualan WHO");
    if (!sheet) throw new Error("Sheet 'Update-Penjualan WHO' tidak ditemukan.");

    const data = getSheetDataCached("Update-Penjualan WHO");
    const headers = data[0].map(h => String(h).trim().toUpperCase());
    const rows = data.slice(1);

    if (rows.length === 0) return { status: "success", branches: [], rows: [] };

    const tglIdx = headers.findIndex(h => h.replace(/\s+/g, '') === 'TANGGAL');
    const cabangIdx = headers.findIndex(h => h.replace(/\s+/g, '') === 'CABANG');
    const jumlahIdx = headers.findIndex(h => h.replace(/\s+/g, '') === 'JUMLAH');
    if (tglIdx === -1 || cabangIdx === -1 || jumlahIdx === -1) {
      throw new Error("Kolom TANGGAL/CABANG/JUMLAH tidak ditemukan.");
    }

    let filterDate = null;
    if (filterMonth) {
      const parts = filterMonth.split('-');
      filterDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }

    let startDate = null;
    if (startMonth) {
      const parts = startMonth.split('-');
      startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }

    const now = new Date();

    // Collect: { dateKey: { branchName: total } }
    const dateBranchMap = {};
    const branchSet = {};

    rows.forEach(row => {
      const tgl = parseTglCell(row[tglIdx]);
      if (!tgl) return;

      // Filter: start month (Laporan Harian from Jan 2026)
      if (startDate && tgl < startDate) return;
      // Filter: specific month (Penjualan Pertanggal)
      if (filterDate && !isSameMonth(tgl, filterDate)) return;
      // Filter: not beyond current month
      if (tgl > now) return;
      // Filter: day of week
      if (dayFilter !== -1 && tgl.getDay() !== dayFilter) return;

      const cabang = String(row[cabangIdx] || '').toUpperCase().trim();
      if (!cabang) return;

      const qty = cleanNum(row[jumlahIdx]);
      const dateKey = Utilities.formatDate(tgl, "GMT+7", "dd/MM/yyyy");

      if (!dateBranchMap[dateKey]) dateBranchMap[dateKey] = {};
      if (!dateBranchMap[dateKey][cabang]) dateBranchMap[dateKey][cabang] = 0;
      dateBranchMap[dateKey][cabang] += qty;

      branchSet[cabang] = true;
    });

    // Build branch list (sorted, exclude IGNORE_BRANCHES-like patterns)
    const ignorePatterns = ["WHP", "TOTAL", "GRAND TOTAL", "TOTAL KESELURUHAN"];
    let allBranches = Object.keys(branchSet)
      .filter(b => !ignorePatterns.some(p => b.includes(p)))
      .sort();
    // Apply WHP filter
    if (userWHP && CONFIG.WHP_MAPPING[userWHP]) {
      var whpAllowed = CONFIG.WHP_MAPPING[userWHP];
      allBranches = allBranches.filter(function(b) {
        return whpAllowed.some(function(c) { return b.indexOf(c) !== -1; });
      });
    }

    // Build pivot rows
    const pivotRows = Object.keys(dateBranchMap).sort((a, b) => {
      const [d1, m1, y1] = a.split('/');
      const [d2, m2, y2] = b.split('/');
      return new Date(y1, m1-1, d1) - new Date(y2, m2-1, d2);
    }).map(dateKey => {
      const branchData = dateBranchMap[dateKey];
      const row = { date: dateKey, grandTotal: 0 };
      allBranches.forEach(b => {
        const val = branchData[b] || 0;
        row[b] = val;
        row.grandTotal += val;
      });
      return row;
    });

    return { status: "success", branches: allBranches, rows: pivotRows };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getBerandaData() {
  return getSalesDashboardData("ALL", "ALL", "");
}

function cleanNum(val) {
  if (typeof val === 'number') return val;
  if (!val || val === '-') return 0;
  // Hapus titik ribuan, ganti koma desimal jadi titik jika ada
  let cleaned = String(val).replace(/\./g, '').replace(/,/g, '.');
  let num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Helper untuk mencocokkan bulan dan tahun (mendukung format string dan objek tanggal)
 */
function isSameMonth(input, targetDate) {
  if (!input) return false;
  const m = targetDate.getMonth();
  const y = targetDate.getFullYear();
  
  const bulanIndo = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
  const bulanEng  = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  
  // Jika input adalah objek Date
  if (input instanceof Date) {
    return input.getMonth() === m && input.getFullYear() === y;
  }
  
  const s = input.toString().toUpperCase().trim();
  
  // Tangani format Tanggal dalam string (Excel DD/MM/YYYY)
  if (s.includes('/')) {
    const p = s.split('/');
    const d = new Date(p[2], p[1]-1, p[0]);
    return (!isNaN(d.getTime()) && d.getMonth() === m && d.getFullYear() === y);
  }
  
  // Tangani format Teks: "JANUARI 2026" atau "MAY 2026"
  const matchIndo = s.includes(bulanIndo[m]) || s.includes(bulanIndo[m].substring(0,3));
  const matchEng  = s.includes(bulanEng[m]) || s.includes(bulanEng[m].substring(0,3));
  return (matchIndo || matchEng) && s.includes(y.toString());
}

/**
 * Mengambil data analitik penjualan untuk Sales Dashboard
 */
function getSalesDashboardData(filterWHO, filterBranch, userWHP) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName("Update-Penjualan WHO");
    const distSheet = ss.getSheetByName("Distribusi");
    const recSheet = ss.getSheetByName("Penerimaan");

    if (!salesSheet || !distSheet || !recSheet) throw new Error("Salah satu sheet (Update-Penjualan WHO/Distribusi/Penerimaan) tidak ditemukan.");

    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // 1. Identifikasi Cabang berdasarkan Filter WHO & User WHP
    let effFilterWHO = filterWHO || "ALL";
    if ((!filterWHO || filterWHO === "ALL") && userWHP) {
      effFilterWHO = userWHP;
    }
    let allowedBranches = []; 
    if (effFilterWHO && effFilterWHO !== "ALL") {
      allowedBranches = CONFIG.WHP_MAPPING[effFilterWHO] || [];
    }

    // 2. Proses Data Penjualan
    const salesData = getSheetDataCached("Update-Penjualan WHO");
    const salesHeader = salesData.shift();

    // Indeks Kolom (A=0, B=1, D=3, AH=33)
    const colBranch = 1;     // Kolom B (CABANG)
    const colTanggal = 3;    // Kolom D (TANGGAL)
    const colJumlah = 33;    // Kolom AH (JUMLAH)

    let totalLastMonth = 0;
    let totalMonthly = 0;
    let totalToday = 0;
    let branchMap = {};
    let dailyMap = {};
    
    let maxTimeCurrMonth = 0;

    salesData.forEach(row => {
      const branchName = String(row[colBranch] || '').toUpperCase().trim();
      const qty = cleanNum(row[colJumlah]); // Kolom AD
      
      // 1. Abaikan baris jika Nama Cabang kosong atau termasuk dalam IGNORE_BRANCHES (TOTAL, WHP, dll)
      if (!branchName || CONFIG.IGNORE_BRANCHES.some(ignore => branchName.includes(ignore))) {
        return;
      }

      // 2. Filter Logika
      if (filterBranch && filterBranch !== "ALL") {
        if (branchName !== filterBranch) return;
      } else if (filterWHO && filterWHO !== "ALL") {
        if (!allowedBranches.some(b => branchName.includes(b))) return;
      }

      // 3. Parsing Tanggal (Kolom D)
      let rawTgl = row[colTanggal];
      let tglObj = null;
      if (rawTgl instanceof Date && !isNaN(rawTgl.getTime())) {
        tglObj = rawTgl;
      } else if (rawTgl) {
        let str = String(rawTgl).trim();
        if (str.includes('/')) {
          let p = str.split('/');
          tglObj = new Date(p[2], p[1]-1, p[0]);
        } else {
          tglObj = new Date(str);
        }
      }

      if (!tglObj) return;

      // Penjualan Bulan Lalu (Berdasarkan Tanggal di Kolom D)
      if (isSameMonth(tglObj, lastMonthDate)) {
        totalLastMonth += qty;
      }

      // Penjualan Bulan Berjalan (Berdasarkan Tanggal di Kolom D)
      if (isSameMonth(tglObj, now)) {
        totalMonthly += qty;
        branchMap[branchName] = (branchMap[branchName] || 0) + qty;
        
        let time = new Date(tglObj.getFullYear(), tglObj.getMonth(), tglObj.getDate()).getTime();
        dailyMap[time] = (dailyMap[time] || 0) + qty;
        if (time > maxTimeCurrMonth) maxTimeCurrMonth = time;
      }
    });

    // Hitung Total Penjualan pada tanggal terakhir yang ditemukan di bulan berjalan
    totalToday = maxTimeCurrMonth > 0 ? dailyMap[maxTimeCurrMonth] : 0;

    // 3. Proses Distribusi (Bulan Berjalan & Split Gudang)
    let distBDG = 0, distTSM = 0;
    var distTotalRows = 0, distSameMonth = 0, distGudangBDG = 0, distGudangTSM = 0;
    try {
      const distSheet = ss.getSheetByName("Distribusi");
      if (distSheet) {
        const distRows = distSheet.getDataRange().getValues();
        distTotalRows = distRows.length;
        distRows.shift();
        distRows.forEach(row => {
          const tglRaw = row[0];
          const cabangDist = String(row[2] || '').toUpperCase().trim();
          const gudang = String(row[1]).toUpperCase();
          const qty = cleanNum(row[3]);

          if (isSameMonth(tglRaw, now)) {
            distSameMonth++;
            if (filterWHO !== "ALL" && !allowedBranches.some(b => cabangDist.includes(b))) return;

            if (gudang.includes("BANDUNG")) { distBDG += qty; distGudangBDG++; }
            else if (gudang.includes("TASIK")) { distTSM += qty; distGudangTSM++; }
          }
        });
      }
    } catch(e) {
      Logger.log('Distribusi sheet error: ' + e);
    }

    // 4. Proses Penerimaan (Bulan Berjalan & Split Gudang)
    let recBDG = 0, recTSM = 0;
    var recTotalRows = 0, recSameMonth = 0;
    try {
      const recSheet = ss.getSheetByName("Penerimaan");
      if (recSheet) {
        const recRows = recSheet.getDataRange().getValues();
        recTotalRows = recRows.length;
        recRows.shift();
        recRows.forEach(row => {
          const tglRaw = row[0];
          const gudang = String(row[1]).toUpperCase();
          const qty = cleanNum(row[2]);
          if (isSameMonth(tglRaw, now)) {
            recSameMonth++;
            if (gudang.includes("BANDUNG")) recBDG += qty;
            else if (gudang.includes("TASIK")) recTSM += qty;
          }
        });
      }
    } catch(e) {
      Logger.log('Penerimaan sheet error: ' + e);
    }

    const ranking = Object.keys(branchMap)
      .map(name => ({ branch: name, total: branchMap[name] }))
      .sort((a, b) => b.total - a.total);

    // Mengambil 15 hari terakhir yang ada transaksi dan diurutkan berdasarkan tanggal
    const sortedDays = Object.keys(dailyMap).sort((a, b) => a - b).slice(-15);

    return {
      status: "success",
      data: {
        kpis: { 
          lastMonth: totalLastMonth, 
          monthly: totalMonthly, 
          growth: totalMonthly - totalLastMonth, 
          today: totalToday, 
          distBDG, distTSM, recBDG, recTSM 
        },
        ranking: ranking,
        dailyTrend: {
          labels: sortedDays.map(t => Utilities.formatDate(new Date(Number(t)), "GMT+7", "dd/MM")),
          values: sortedDays.map(k => dailyMap[k])
        },
        _debug: {
          distTotalRows, distSameMonth, distGudangBDG, distGudangTSM,
          recTotalRows, recSameMonth,
          effFilterWHO,
          filterWHO: filterWHO
        }
      }
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getSalesHubData(userWHP, currDateStr, prevDateStr, backdateStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Update-Penjualan WHO");
    if (!sheet) throw new Error("Sheet 'Update-Penjualan WHO' tidak ditemukan.");

    const data = getSheetDataCached("Update-Penjualan WHO");
    const rows = data.slice(1);

    const colBranch = 1;
    const colTipe = 2;
    const colTanggal = 3;
    const colJumlah = 33;

    function parseYMD(str) {
      if (!str) return null;
      var p = str.split('-');
      return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    }

    var currDate = parseYMD(currDateStr) || new Date();
    var prevDate = parseYMD(prevDateStr) || new Date();

    var currentMonth = currDate.getMonth();
    var currentYear = currDate.getFullYear();
    var currDayNum = currDate.getDate();

    var prevMonth = prevDate.getMonth();
    var prevYear = prevDate.getFullYear();
    var prevDayNum = prevDate.getDate();

    // Gunakan backdate untuk snapshot jika ada, otherwise pakai currDate
    var backDate = parseYMD(backdateStr) || currDate;
    var snapMonth = backDate.getMonth();
    var snapYear = backDate.getFullYear();
    var snapDay = backDate.getDate();

    // Tentukan 3 tanggal snapshot (current, M-1, M-2) dengan day = snapDay
    var snapDates = [];
    for (var sm = 0; sm < 3; sm++) {
      var m = snapMonth - sm;
      var y = snapYear;
      if (m < 0) { m += 12; y--; }
      var maxD = new Date(y, m + 1, 0).getDate();
      var d = Math.min(snapDay, maxD);
      snapDates.push(new Date(y, m, d));
    }

    let dailyAll = {};
    let snapshotBranchSet = {};

    function mapTipe(tipe) {
      if (tipe === 'ORE' || tipe === 'TsiEmployee') return 'KARYAWAN';
      if (tipe === 'ORM' || tipe === 'TsiApps') return 'TSIAPPS';
      return tipe;
    }

    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    rows.forEach(function(row) {
      var branchName = String(row[colBranch] || '').toUpperCase().trim();
      if (!branchName || CONFIG.IGNORE_BRANCHES.some(function(ignore) { return branchName.includes(ignore); })) return;

      if (userWHP && CONFIG.WHP_MAPPING[userWHP]) {
        var allowed = CONFIG.WHP_MAPPING[userWHP];
        if (!allowed.some(function(b) { return branchName.includes(b); })) return;
      }

      var tipe = mapTipe(String(row[colTipe] || '').trim());
      var qty = cleanNum(row[colJumlah]);

      var tgl = parseTglCell(row[colTanggal]);
      if (!tgl) return;

      var month = tgl.getMonth();
      var year = tgl.getFullYear();
      var dateKey = Utilities.formatDate(tgl, "GMT+7", "yyyy-MM-dd");

      if (!dailyAll[dateKey]) dailyAll[dateKey] = {};
      if (!dailyAll[dateKey][branchName]) dailyAll[dateKey][branchName] = { MST:0, STK:0, KARYAWAN:0, TSIAPPS:0, MSI:0 };
      dailyAll[dateKey][branchName][tipe] = (dailyAll[dateKey][branchName][tipe] || 0) + qty;

      if (snapDates.some(function(s) { return s.getMonth() === month && s.getFullYear() === year; })) {
        snapshotBranchSet[branchName] = true;
      }
    });

    // Single pass: hitung daily totals & branch totals per bulan
    var currentData = {}, previousData = {};
    var currentDaily = {}, previousDaily = {};
    var prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();

    Object.keys(dailyAll).forEach(function(dk) {
      var dt = new Date(dk + 'T00:00:00');
      var m = dt.getMonth(), y = dt.getFullYear(), day = dt.getDate();
      var branches = dailyAll[dk] || {};
      var dayTotal = 0;

      Object.keys(branches).forEach(function(b) {
        var t = branches[b];
        var sum = (t['STK'] || 0) + (t['MST'] || 0) + (t['KARYAWAN'] || 0) + (t['TSIAPPS'] || 0) + (t['MSI'] || 0);
        dayTotal += sum;

        if (m === currentMonth && y === currentYear && day <= currDayNum) {
          if (!currentData[b]) currentData[b] = { MST:0, STK:0, KARYAWAN:0, TSIAPPS:0, MSI:0 };
          ['MST','STK','KARYAWAN','TSIAPPS','MSI'].forEach(function(tc) {
            currentData[b][tc] = (currentData[b][tc] || 0) + (branches[b][tc] || 0);
          });
        }
        if (m === prevMonth && y === prevYear && day <= currDayNum) {
          if (!previousData[b]) previousData[b] = { MST:0, STK:0, KARYAWAN:0, TSIAPPS:0, MSI:0 };
          ['MST','STK','KARYAWAN','TSIAPPS','MSI'].forEach(function(tc) {
            previousData[b][tc] = (previousData[b][tc] || 0) + (branches[b][tc] || 0);
          });
        }
      });

      if (m === currentMonth && y === currentYear && day <= currDayNum)
        currentDaily[day] = (currentDaily[day] || 0) + Math.round(dayTotal);
      if (m === prevMonth && y === prevYear && day <= currDayNum)
        previousDaily[day] = (previousDaily[day] || 0) + Math.round(dayTotal);
    });

    var branchSet = {};
    Object.keys(currentData).forEach(function(b) { branchSet[b] = true; });
    Object.keys(previousData).forEach(function(b) { branchSet[b] = true; });
    var allBranches = Object.keys(branchSet).sort();
    var snapshotBranches = Object.keys(snapshotBranchSet).sort();

    function buildTable(dataMap) {
      return allBranches.map(function(b) {
        var d = dataMap[b] || {};
        return {
          warehouse: b,
          stokis: Math.round(d['STK'] || 0),
          masterStokis: Math.round(d['MST'] || 0),
          karyawan: Math.round(d['KARYAWAN'] || 0),
          tsiApps: Math.round(d['TSIAPPS'] || 0),
          msi: Math.round(d['MSI'] || 0),
          total: Math.round((d['STK'] || 0) + (d['MST'] || 0) + (d['KARYAWAN'] || 0) + (d['TSIAPPS'] || 0) + (d['MSI'] || 0))
        };
      });
    }

    function buildSnapshotTable(branchData) {
      return snapshotBranches.map(function(b) {
        var d = branchData[b] || {};
        return {
          warehouse: b,
          stokis: Math.round(d['STK'] || 0),
          masterStokis: Math.round(d['MST'] || 0),
          karyawan: Math.round(d['KARYAWAN'] || 0),
          tsiApps: Math.round(d['TSIAPPS'] || 0),
          msi: Math.round(d['MSI'] || 0),
          total: Math.round((d['STK'] || 0) + (d['MST'] || 0) + (d['KARYAWAN'] || 0) + (d['TSIAPPS'] || 0) + (d['MSI'] || 0))
        };
      });
    }

    var currentTable = buildTable(currentData);
    var previousTable = buildTable(previousData);

    var currentTotal = currentTable.reduce(function(s, r) { return s + r.total; }, 0);
    var previousTotal = previousTable.reduce(function(s, r) { return s + r.total; }, 0);
    var delta = currentTotal - previousTotal;
    var growthPct = previousTotal === 0 ? (delta > 0 ? 100 : 0) : Math.round((delta / previousTotal) * 100);

    // Snapshot: data persis di masing-masing snapDates
    var dateSnapshots = [];
    snapDates.forEach(function(sd) {
      var key = Utilities.formatDate(sd, "GMT+7", "yyyy-MM-dd");
      var branchData = dailyAll[key] || {};
      var label = Utilities.formatDate(sd, "GMT+7", "dd MMM yy");
      dateSnapshots.push({ date: label, data: buildSnapshotTable(branchData) });
    });

    // Total penjualan hari ini
    var todayKey = Utilities.formatDate(snapDates[0], "GMT+7", "yyyy-MM-dd");
    var todayBranchData = dailyAll[todayKey] || {};
    var todayTotal = 0;
    Object.keys(todayBranchData).forEach(function(b) {
      var d = todayBranchData[b];
      todayTotal += (d['STK'] || 0) + (d['MST'] || 0) + (d['KARYAWAN'] || 0) + (d['TSIAPPS'] || 0) + (d['MSI'] || 0);
    });

    var dailyComparison = [];
    for (var d = 1; d <= currDayNum; d++) {
      var cur = currentDaily[d] || 0;
      var prev = (d <= prevMonthLastDay) ? (previousDaily[d] || 0) : 0;
      dailyComparison.push({
        date: String(d).padStart(2, '0') + '/' + String(currentMonth + 1).padStart(2, '0'),
        current: cur,
        previous: prev,
        delta: cur - prev
      });
    }

    var currentLabel = monthNames[currentMonth] + ' ' + currentYear;
    var prevLabel = monthNames[prevMonth] + ' ' + prevYear;

    return {
      status: "success",
      data: {
        currentMonth: { label: currentLabel, data: currentTable },
        previousMonth: { label: prevLabel, data: previousTable },
        kpis: { delta: delta, growthPct: growthPct, currentTotal: currentTotal, previousTotal: previousTotal, currentDays: currDayNum, todayTotal: Math.round(todayTotal) },
        dateSnapshots: dateSnapshots,
        branches: allBranches,
        dailyComparison: dailyComparison
      }
    };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
