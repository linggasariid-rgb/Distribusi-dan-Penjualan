/**
 * Dashboard Distribusi WHO - Versi Dinamis Sisa Hari
 * Powered by ATR Crafted by SND
 */

function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Dashboard Distribusi WHO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Fungsi untuk memanggil file HTML terpisah (SPA Architecture)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

const CONFIG = {
  SPREADSHEET_ID: "1znxLIojUXuPNjL9O2b3l_knG6cgY0sSVmTeKh78Dwbw",
  PRODUCT_INFO: {
    "SPS TSI":    { ctn: 1000, targetStock: 8 },
    "SKM TSI":    { ctn: 1000, targetStock: 8 },
    "SM":         { ctn: 1000, targetStock: 8 },
    "SP19 TSI":   { ctn: 500, targetStock: 8 },
    "SPF":        { ctn: 1000, targetStock: 8 },
    "SMM":        { ctn: 1000, targetStock: 8 },
    "ST":         { ctn: 700, targetStock: 8 },
    "SSJ":        { ctn: 1000, targetStock: 8 },
    "STM":        { ctn: 700, targetStock: 8 },
    "SKMF":       { ctn: 1000, targetStock: 8 },
    "SK":         { ctn: 320, targetStock: 8 },
    "SNN ORG":    { ctn: 1000, targetStock: 8 },
    "SNN Mind":   { ctn: 1000, targetStock: 8 },
    "SNN Menthol":{ ctn: 700, targetStock: 8, alias: "SNNM" },
    "SPW":        { ctn: 500, targetStock: 8 },
    "SP":         { ctn: 500, targetStock: 8 },
    "KMK":        { ctn: 40, targetStock: 8, alias: "KMK" },
    "KOOR":       { ctn: 40, targetStock: 8, alias: "KO" },
    "SSE":        { ctn: 1000, targetStock: 8 },
    "HU":         { ctn: 10, targetStock: 8 }
  },
  SPECIAL_ROUND_UP: ["SP19 TSI", "SKM TSI", "SSJ", "SNN ORG"],
  CABANG_FULL_TIME: ["BOGOR", "TANGERANG", "SUKABUMI", "TASIKMALAYA", "KARAWANG", "BANDUNG"],
  WHP_MAPPING: {
    "WHP BANDUNG": ["BANDUNG", "PURWAKARTA", "KARAWANG", "SUKABUMI", "BOGOR", "TANGERANG", "SERANG"],
    "WHP TASIKMALAYA": ["TASIKMALAYA", "GARUT", "CIREBON"]
  },
  IGNORE_BRANCHES: ["WHP BANDUNG", "WHP TASIKMALAYA", "TOTAL", "GRAND TOTAL", "TOTAL KESELURUHAN", "BANYUMAS"],
  LIBUR_NASIONAL: [
    "2026-01-01", "2026-01-16", "2026-02-17", "2026-03-19",
    "2026-03-21", "2026-03-22", "2026-04-03", "2026-04-05",
    "2026-05-01", "2026-05-14", "2026-05-27", "2026-05-31",
    "2026-06-01", "2026-06-16", "2026-08-17", "2026-08-25", "2026-12-25"
  ]
};

function getDistributionData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName("Update-Penjualan WHO");
    const stockSheet = ss.getSheetByName("Update-STOCK");
    
    if (!salesSheet || !stockSheet) throw new Error("Sheet Penjualan atau Stock tidak ditemukan.");

    const productList = Object.keys(CONFIG.PRODUCT_INFO);
    const salesData = salesSheet.getDataRange().getValues();
    const stockData = stockSheet.getDataRange().getValues();
    
    let salesHeader = salesData[0].map(h => String(h).replace(/\s+/g, '').toUpperCase());
    let stockHeader = stockData[0].map(h => String(h).replace(/\s+/g, '').toUpperCase());
    
    // Cari urutan kolom secara dinamis dari header
    let dateColIdx = salesData[0].findIndex(h => String(h).toUpperCase().trim() === 'TANGGAL');
    if (dateColIdx === -1) throw new Error("Kolom 'Tanggal' tidak ditemukan di sheet 'Update-Penjualan WHO'.");
    let branchColIdx = salesData[0].findIndex(h => String(h).toUpperCase().trim() === 'CABANG');
    if (branchColIdx === -1) throw new Error("Kolom 'CABANG' tidak ditemukan di sheet 'Update-Penjualan WHO'.");

    const productIdxMap = {};
    productList.forEach(p => {
      let cleanName = p.replace(/\s+/g, '').toUpperCase();
      let alias = CONFIG.PRODUCT_INFO[p].alias ? CONFIG.PRODUCT_INFO[p].alias.toUpperCase() : null;
      productIdxMap[p] = {
        sales: salesHeader.findIndex(h => {
          const cleanH = String(h).replace(/\s+/g, '').toUpperCase();
          return cleanH === cleanName || (alias && cleanH === alias);
        }),
        stock: stockHeader.indexOf(cleanName) // Stock sheet uses official names
      };
    });

    let today = new Date();
    today.setHours(23, 59, 59, 999);
    let startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    startDate.setHours(0, 0, 0, 0);

    let result = {};

    // 1. PROSES PENJUALAN
    for (let i = 1; i < salesData.length; i++) {
      let row = salesData[i];
      if (!row[dateColIdx] || !row[branchColIdx]) continue;
      
      // Tangani format tanggal DD/MM/YYYY dari copy paste Excel
      let rawDate = String(row[dateColIdx]).trim();
      let tgl;
      if (rawDate.includes('/')) {
        let parts = rawDate.split('/');
        tgl = new Date(parts[2], parts[1] - 1, parts[0]);
      } else {
        tgl = new Date(rawDate);
      }
      let cabangKey = String(row[branchColIdx]).trim().toUpperCase();

      if (!(tgl instanceof Date && !isNaN(tgl))) continue;
      if (tgl < startDate || tgl > today) continue;
      
      // Abaikan jika nama cabang mengandung kata kunci yang di-ignore
      if (CONFIG.IGNORE_BRANCHES.some(ignore => cabangKey.includes(ignore))) continue;

      if (!result[cabangKey]) {
        let isFullTime = CONFIG.CABANG_FULL_TIME.includes(cabangKey);
        result[cabangKey] = { 
          pembagi: calculateWorkDays(startDate, today, isFullTime), 
          produk: {} 
        };
        productList.forEach(p => {
          result[cabangKey].produk[p] = { salesTotal: 0, currentStock: 0 };
        });
      }
      result[cabangKey].nama = String(row[1]).trim();
      
      productList.forEach(p => {
        let colIdx = productIdxMap[p].sales;
        if (colIdx > -1) {
          let rawVal = String(row[colIdx]).trim();
          result[cabangKey].produk[p].salesTotal += (Number(rawVal.replace(/\./g, '')) || 0);
        }
      });
    }

    // 2. PROSES STOK
    let whpStockData = {};

    for (let i = 1; i < stockData.length; i++) {
      let row = stockData[i];
      if (!row[0]) continue;
      let cabangStok = String(row[0]).trim().toUpperCase(); 
      
      // Cek jika ini adalah baris stok untuk Gudang Utama (WHP)
      let isWHP = Object.keys(CONFIG.WHP_MAPPING).find(w => cabangStok.includes(w));
      if (isWHP) {
        if (!whpStockData[isWHP]) whpStockData[isWHP] = {};
        productList.forEach(p => {
          let colIdx = productIdxMap[p].stock;
          if (colIdx > -1 && whpStockData[isWHP][p] === undefined) {
            let rawVal = String(row[colIdx]).trim();
            whpStockData[isWHP][p] = Number(rawVal.replace(/\./g, '')) || 0;
          }
        });
        continue; // Lanjut ke baris berikutnya, jangan dimasukkan sebagai cabang biasa
      }

      // Abaikan jika nama cabang mengandung kata kunci yang di-ignore
      if (CONFIG.IGNORE_BRANCHES.some(ignore => cabangStok.includes(ignore))) continue;

      if (!result[cabangStok]) {
        let isFullTime = CONFIG.CABANG_FULL_TIME.includes(cabangStok);
        result[cabangStok] = { 
          nama: String(row[0]).trim(), 
          pembagi: calculateWorkDays(startDate, today, isFullTime), 
          produk: {} 
        };
        productList.forEach(p => {
          result[cabangStok].produk[p] = { salesTotal: 0, currentStock: 0 };
        });
      }
      
      productList.forEach(p => {
        let colIdx = productIdxMap[p].stock;
        if (colIdx > -1) {
          let rawVal = String(row[colIdx]).trim();
          result[cabangStok].produk[p].currentStock = Number(rawVal.replace(/\./g, '')) || 0;
        }
      });
    }

    return { 
      status: "success", 
      data: { 
        result, 
        productList, 
        productInfo: CONFIG.PRODUCT_INFO, 
        whpMapping: CONFIG.WHP_MAPPING, 
        specialRoundUp: CONFIG.SPECIAL_ROUND_UP,
        whpStockData 
      } 
    };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function calculateWorkDays(start, end, isFullTime) {
  let count = 0;
  let cur = new Date(start);
  while (cur <= end) {
    let day = cur.getDay();
    let dStr = Utilities.formatDate(cur, "GMT+7", "yyyy-MM-dd");
    let isH = CONFIG.LIBUR_NASIONAL.includes(dStr);
    if (isFullTime) { 
      count++; // Buka setiap hari, mengabaikan libur dan hari minggu
    } else { 
      if (day !== 0 && !isH) count++; // Cabang non-fulltime libur di hari minggu dan libur nasional
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count || 1;
}

function savePastedData(data, type, branch, subType) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let targetSheetName = '';
    
    if (type === 'penjualan') {
      targetSheetName = 'Update-Penjualan WHO';
    } else if (type === 'penerimaan') {
      targetSheetName = 'Update-Penerimaan WHO'; // Pastikan sheet ini ada
    } else {
      throw new Error("Tipe data tidak valid. Harus 'penjualan' atau 'penerimaan'.");
    }

    const targetSheet = ss.getSheetByName(targetSheetName);
    if (!targetSheet) {
      throw new Error(`Sheet dengan nama "${targetSheetName}" tidak ditemukan. Harap buat sheet tersebut terlebih dahulu.`);
    }

    const targetHeader = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toUpperCase());
    const sourceHeader = data[0].map(h => String(h).trim().toUpperCase());
    const sourceDataRows = data.slice(1);

    const sourceHeaderMap = {};
    sourceHeader.forEach((h, i) => {
      if (h) sourceHeaderMap[h] = i;
    });

    const dataToAppend = sourceDataRows.map(sourceRow => {
      const newRow = Array(targetHeader.length).fill('');
      
      targetHeader.forEach((targetColName, targetIndex) => {
        let cleanTargetCol = targetColName.replace(/\s+/g, '');
        
        if (cleanTargetCol === 'CABANG') {
          newRow[targetIndex] = branch;
        } 
        else if (cleanTargetCol === 'TIPECUSTOMER' && type === 'penjualan') {
          if (subType === 'tsiapps') {
             newRow[targetIndex] = 'TsiApps';
          } else if (subType === 'employee') {
             newRow[targetIndex] = 'TsiEmployee';
          } else {
             const fakturIndex = sourceHeader.findIndex(h => h.includes('FAKTUR'));
             let tipe = '';
             if (fakturIndex !== -1) {
               let fVal = String(sourceRow[fakturIndex]).toUpperCase();
               if (fVal.includes('MST')) tipe = 'MST';
               else if (fVal.includes('STK')) tipe = 'STK';
               else tipe = fVal; // fallback
             }
             newRow[targetIndex] = tipe;
          }
        }
        else if (targetColName === 'BULAN') {
          const dateIndex = sourceHeader.findIndex(h => h.includes('TANGGAL'));
          let monthValue = '';
          if (dateIndex !== -1) {
            const rawDate = sourceRow[dateIndex];
            if (rawDate) {
              let tgl;
              if (String(rawDate).includes('/')) {
                let parts = String(rawDate).split('/');
                tgl = new Date(parts[2], parts[1] - 1, parts[0]);
              } else {
                tgl = new Date(rawDate);
              }
              if (tgl instanceof Date && !isNaN(tgl)) {
                monthValue = Utilities.formatDate(tgl, "GMT+7", "MMMM yyyy").toUpperCase();
              }
            }
          }
          newRow[targetIndex] = monthValue;
        } else {
          let sourceIndex = sourceHeaderMap[targetColName];
          if (sourceIndex === undefined && CONFIG.PRODUCT_INFO[targetColName]?.alias) {
            sourceIndex = sourceHeaderMap[CONFIG.PRODUCT_INFO[targetColName].alias.toUpperCase()];
          }
          
          if (sourceIndex === undefined) {
             if (targetColName === 'NO. PURCHASE ORDER') sourceIndex = sourceHeaderMap['NO. ORDER MEMBER'];
             if (targetColName === 'NAMA PDM') sourceIndex = sourceHeaderMap['NAMA'];
          }

          if (sourceIndex !== undefined && sourceRow[sourceIndex] !== undefined) {
            newRow[targetIndex] = sourceRow[sourceIndex];
          }
        }
      });
      return newRow;
    });

    if (dataToAppend.length > 0) {
      targetSheet.getRange(targetSheet.getLastRow() + 1, 1, dataToAppend.length, dataToAppend[0].length).setValues(dataToAppend);
    } else {
      throw new Error("Tidak ada baris data untuk disimpan.");
    }

    const stockUpdateResult = updateStockSheet(data, type, branch);
    if (stockUpdateResult.status !== 'success') {
        throw new Error(stockUpdateResult.message);
    }

    return { status: "success", message: `Data ${type} berhasil disimpan dan stok telah diperbarui.` };
  } catch (e) {
    Logger.log(e);
    return { status: "error", message: e.toString() };
  }
}

function savePastedDataWHO(data) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const targetSheet = ss.getSheetByName("Update-Penjualan WHO");
        if (!targetSheet) throw new Error("Sheet 'Update-Penjualan WHO' tidak ditemukan.");

        const lastCol = targetSheet.getLastColumn();
        if (lastCol === 0) throw new Error("Sheet target kosong (tidak ada kolom).");

        const targetRaw = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        const targetHeader = targetRaw.map(h => String(h).trim().toUpperCase());

        // Deteksi apakah baris pertama adalah header (mengandung keyword header)
        const headerKeywords = ['BULAN', 'CABANG', 'TANGGAL', 'NO.', 'FAKTUR', 'CUSTOMER'];
        const firstRow = data[0].map(v => String(v).trim().toUpperCase());
        const hasHeader = headerKeywords.some(kw => firstRow.some(v => v.startsWith(kw)));

        let sourceDataRows;
        if (hasHeader) {
            sourceDataRows = data.slice(1);
        } else {
            sourceDataRows = data;
        }

        const srcColCount = sourceDataRows[0].length;

        // Source columns match target columns positionally (kolom A = BULAN, ..., AH = JUMLAH)
        const colMapping = targetHeader.map((tCol, tIdx) => {
            if (tIdx < srcColCount) return tIdx;
            return -1;
        });

        const dataToAppend = sourceDataRows.map(sourceRow => {
            const newRow = Array(targetHeader.length).fill('');
            colMapping.forEach((sourceIdx, targetIdx) => {
                if (sourceIdx >= 0 && sourceIdx < sourceRow.length && sourceRow[sourceIdx] !== undefined) {
                    newRow[targetIdx] = sourceRow[sourceIdx];
                }
            });
            return newRow;
        });

        if (dataToAppend.length === 0) {
            throw new Error("Tidak ada baris data untuk disimpan.");
        }

        targetSheet.getRange(targetSheet.getLastRow() + 1, 1, dataToAppend.length, dataToAppend[0].length).setValues(dataToAppend);

        return { status: "success", message: `Data berhasil disimpan (${dataToAppend.length} baris).` };

    } catch (e) {
        Logger.log(e);
    return { status: "error", message: e.toString() };
  }
}

function getBestProductsData(filterMonth) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Update-Penjualan WHO");
    if (!sheet) throw new Error("Sheet 'Update-Penjualan WHO' tidak ditemukan.");

    const data = sheet.getDataRange().getValues();
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

    const data = sheet.getDataRange().getValues();
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

function getSalesDailyReport(dayFilter, filterMonth, startMonth) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Update-Penjualan WHO");
    if (!sheet) throw new Error("Sheet 'Update-Penjualan WHO' tidak ditemukan.");

    const data = sheet.getDataRange().getValues();
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

function updateStockSheet(transactionData, type, branch) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const stockSheet = ss.getSheetByName("Update-STOCK");
        if (!stockSheet) throw new Error("Sheet 'Update-STOCK' tidak ditemukan.");

        const stockRange = stockSheet.getDataRange();
        const stockValues = stockRange.getValues();

        const stockHeader = stockValues[0].map(h => String(h).trim().toUpperCase());
        const transactionHeader = transactionData[0].map(h => String(h).trim().toUpperCase());
        const productList = Object.keys(CONFIG.PRODUCT_INFO);

        const stockBranchColIndex = 0; // Kolom 'CABANG' di sheet stok

        const stockBranchMap = {};
        for (let i = 1; i < stockValues.length; i++) {
            const branchName = String(stockValues[i][stockBranchColIndex]).trim().toUpperCase();
            if (branchName) stockBranchMap[branchName] = i;
        }

        const stockRowIndex = stockBranchMap[String(branch).toUpperCase()];
        if (stockRowIndex === undefined) throw new Error(`Cabang ${branch} tidak ditemukan di sheet Update-STOCK.`);

        for (let i = 1; i < transactionData.length; i++) {
            const transactionRow = transactionData[i];

            for (let j = 0; j < transactionHeader.length; j++) {
                const pastedColName = transactionHeader[j];
                if (!pastedColName) continue;

                const officialProductName = productList.find(p => {
                    const pInfo = CONFIG.PRODUCT_INFO[p];
                    const cleanP = p.replace(/\s+/g, '').toUpperCase();
                    const pastedClean = pastedColName.replace(/\s+/g, '');
                    const alias = pInfo.alias ? pInfo.alias.toUpperCase() : null;
                    const aliasClean = alias ? alias.replace(/\s+/g, '') : null;
                    return pastedColName === cleanP || pastedClean === cleanP || (alias && (pastedColName === alias || pastedClean === aliasClean));
                });

                if (officialProductName) {
                    const stockColIndex = stockHeader.indexOf(officialProductName.toUpperCase().replace(/\s+/g, ''));
                    if (stockColIndex > -1) {
                        let rawVal = String(transactionRow[j]).trim();
                        let productValue = (rawVal !== '-' && rawVal !== '') ? (Number(rawVal.replace(/\./g, '')) || 0) : 0;
                        
                        if (productValue !== 0) {
                            let curStockStr = String(stockValues[stockRowIndex][stockColIndex]).trim();
                            const currentStock = Number(curStockStr.replace(/\./g, '')) || 0;
                            stockValues[stockRowIndex][stockColIndex] = (type === 'penjualan') ? (currentStock - productValue) : (currentStock + productValue);
                        }
                    }
                }
            }
        }
        stockRange.setValues(stockValues);
        return { status: 'success' };
    } catch (e) {
        Logger.log(e);
        return { status: 'error', message: e.toString() };
    }
}

/**
 * Helper untuk membersihkan angka dari string (menghapus titik ribuan)
 */
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
function getSalesDashboardData(filterWHO, filterBranch) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName("Update-Penjualan WHO");
    const distSheet = ss.getSheetByName("Distribusi");
    const recSheet = ss.getSheetByName("Penerimaan");

    if (!salesSheet || !distSheet || !recSheet) throw new Error("Salah satu sheet (Update-Penjualan WHO/Distribusi/Penerimaan) tidak ditemukan.");

    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // 1. Identifikasi Cabang berdasarkan Filter WHO
    let allowedBranches = []; 
    if (filterWHO && filterWHO !== "ALL") {
      allowedBranches = CONFIG.WHP_MAPPING[filterWHO] || [];
    }

    // 2. Proses Data Penjualan
    const salesData = salesSheet.getDataRange().getValues();
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
    const distRows = distSheet.getDataRange().getValues();
    distRows.shift();
    distRows.forEach(row => {
      const tglRaw = row[0]; // Kolom A: Tanggal
      const cabangDist = String(row[2] || '').toUpperCase().trim(); // Kolom C: Nama Cabang

      if (isSameMonth(tglRaw, now)) {
        // Filter WHO untuk Distribusi
        if (filterWHO !== "ALL" && !allowedBranches.some(b => cabangDist.includes(b))) return;

        const gudang = String(row[1]).toUpperCase();
        const qty = cleanNum(row[3]);
        if (gudang.includes("BANDUNG")) distBDG += qty;
        else if (gudang.includes("TASIK")) distTSM += qty;
      }
    });

    // 4. Proses Penerimaan (Bulan Berjalan & Split Gudang)
    let recBDG = 0, recTSM = 0;
    const recRows = recSheet.getDataRange().getValues();
    recRows.shift();
    recRows.forEach(row => {
      const tglRaw = row[0]; // Kolom A: Tanggal
      if (isSameMonth(tglRaw, now)) {
        const gudang = String(row[1]).toUpperCase();
        const qty = cleanNum(row[2]);
        if (gudang.includes("BANDUNG")) recBDG += qty;
        else if (gudang.includes("TASIK")) recTSM += qty;
      }
    });

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
        }
      }
    };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// ──── CONTROL POINT (BIZ vs Update-STOCK) ───────────────────────────────────
function getControlPointData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var bizSheet = ss.getSheetByName("BIZ") || ss.getSheetByName(".BIZ");
    var stockSheet = ss.getSheetByName("Update-STOCK");
    if (!bizSheet) return { error: "Sheet 'BIZ' tidak ditemukan!" };
    if (!stockSheet) return { error: "Sheet 'Update-STOCK' tidak ditemukan!" };

    var bizData = bizSheet.getDataRange().getValues();
    var stockData = stockSheet.getDataRange().getValues();

    if (stockData.length < 2) return { error: "Data Update-STOCK kosong." };

    // BIZ sheet: header di baris 4 (index 3), data mulai baris 5 (index 4)
    var HEADER_ROW = 3;
    var DATA_START = 4;

    if (bizData.length <= DATA_START) return { error: "Data BIZ kosong." };

    var productMap = {
      "Sin Platinum Special": "SPS TSI",
      "Sin Kujang Mas": "SKM TSI",
      "Sinergi Mind": "SM",
      "Sin Provost 19": "SP19 TSI",
      "Sin Platinum Filter": "SPF",
      "Sinergi Mind Menthol": "SMM",
      "Sin Trust": "ST",
      "Sin Sapu Jagat": "SSJ",
      "Sin Trust Menthol": "STM",
      "Sin Kujang Mas Filter": "SKMF",
      "Sin Krakatau": "SK",
      "Sin New Normal Org": "SNN ORG",
      "Sin New Normal Mind": "SNN Mind",
      "Sin New Normal Menthol": "SNN Menthol",
      "Kartu Hu versi Baru": "HU",
      "Kopi Mana Kopi": "KMK",
      "Kopi Original": "KOOR",
      "SIN Precision White": "SPW",
      "SIN Precision": "SP",
      "SIN Encode": "SSE"
    };

    var stockHeader = stockData[0].map(function(h) {
      return String(h).trim().toUpperCase().replace(/\s+/g, '');
    });

    // Cari kolom produk di BIZ dari header row 4
    var productCols = [];
    var bizHeader = bizData[HEADER_ROW];
    for (var j = 0; j < bizHeader.length; j++) {
      var bizName = String(bizHeader[j]).trim();
      if (productMap[bizName]) {
        var stockName = productMap[bizName];
        var stockKey = stockName.toUpperCase().replace(/\s+/g, '');
        var stockCol = stockHeader.indexOf(stockKey);
        if (stockCol > -1) {
          productCols.push({ bizCol: j, stockCol: stockCol, bizName: bizName });
        }
      }
    }

    if (productCols.length === 0) {
      return { error: "Tidak ada produk yang cocok antara BIZ dan Update-STOCK." };
    }

    // Helper: cari nama cabang dari baris (coba kolom B dulu, lalu kolom A)
    function _getCabang(row) {
      var name = String(row[1]).trim();
      if (name) return name.toUpperCase();
      name = String(row[0]).trim();
      if (name && isNaN(Number(name))) return name.toUpperCase();
      return '';
    }

    // Baca data BIZ
    var branchNames = [];
    var tasikBizRow = null;
    var bandungBizRow = null;
    var bizCabangFound = [];
    for (var i = DATA_START; i < bizData.length; i++) {
      var cabang = _getCabang(bizData[i]);
      bizCabangFound.push(cabang || '(kosong)');
      if (!cabang) continue;
      if (cabang === "TASIKMALAYA") {
        tasikBizRow = bizData[i];
      } else if (cabang.indexOf("TASIK") !== -1) {
        // "TAMPUNGAN TASIK" etc — skip, bukan Tasikmalaya utama
        continue;
      } else if (cabang === "GUDANG BDG" || cabang === "GUDANG BANDUNG" || cabang === "GDG BANDUNG" || cabang === "WHP BANDUNG") {
        bandungBizRow = bizData[i];
      } else {
        branchNames.push({ name: cabang, row: bizData[i] });
      }
    }

    // Baca Update-STOCK
    var stockByBranch = {};
    var tasikStockRow = null;
    var whpTasikRow = null;
    var whpBandungRow = null;
    var stockCabangFound = [];
    for (var i = 1; i < stockData.length; i++) {
      var cabang = String(stockData[i][0]).trim().toUpperCase();
      stockCabangFound.push(cabang || '(kosong)');
      if (!cabang) continue;
      if (cabang === "TASIKMALAYA") {
        tasikStockRow = stockData[i];
      } else if (cabang === "WHP TASIKMALAYA" || cabang.indexOf("WHP TASIK") !== -1) {
        whpTasikRow = stockData[i];
      } else if (cabang.indexOf("WHP BANDUNG") !== -1) {
        whpBandungRow = stockData[i];
      } else {
        stockByBranch[cabang] = stockData[i];
      }
    }

    Logger.log("BIZ cabang: " + JSON.stringify(bizCabangFound));
    Logger.log("STOCK cabang: " + JSON.stringify(stockCabangFound));
    Logger.log("tasikBizRow: " + (tasikBizRow ? "found" : "null"));
    Logger.log("tasikStockRow: " + (tasikStockRow ? "found" : "null"));
    Logger.log("whpTasikRow: " + (whpTasikRow ? "found" : "null"));
    Logger.log("bandungBizRow: " + (bandungBizRow ? "found" : "null"));
    Logger.log("whpBandungRow: " + (whpBandungRow ? "found" : "null"));

    function _getVal(row, col) {
      var v = row[col];
      return (v === undefined || v === null || v === '' || v === '-') ? 0 : (Number(v) || 0);
    }

    function _compare(bizRow, stockRow) {
      var issues = [];
      var totalSelisih = 0;
      for (var k = 0; k < productCols.length; k++) {
        var pc = productCols[k];
        var bizVal = _getVal(bizRow, pc.bizCol);
        var stockVal = _getVal(stockRow, pc.stockCol);
        var selisih = bizVal - stockVal;
        if (Math.abs(selisih) > 0.1) {
          totalSelisih += Math.abs(selisih);
          issues.push({
            produk: pc.bizName,
            biz: Number(bizVal).toLocaleString('id-ID'),
            excel: Number(stockVal).toLocaleString('id-ID'),
            selisih: Number(selisih).toLocaleString('id-ID')
          });
        }
      }
      return { issues: issues, totalSelisih: totalSelisih };
    }

    var report = [];

    for (var b = 0; b < branchNames.length; b++) {
      var branch = branchNames[b];
      var stockRow = stockByBranch[branch.name];
      if (!stockRow) continue;
      var result = _compare(branch.row, stockRow);
      report.push({
        cabang: branch.name,
        status: result.issues.length === 0 ? "MATCH" : "MISMATCH",
        totalSelisih: result.totalSelisih,
        details: result.issues
      });
    }

    // Konsolidasi Tasikmalaya: BIZ[TASIKMALAYA] vs STOCK[TASIKMALAYA] + STOCK[WHP TASIKMALAYA]
    if (tasikBizRow || tasikStockRow || whpTasikRow) {
      var tasikIssues = [];
      var totalTasik = 0;
      for (var k = 0; k < productCols.length; k++) {
        var pc = productCols[k];
        var bizVal = tasikBizRow ? _getVal(tasikBizRow, pc.bizCol) : 0;
        var stockVal1 = tasikStockRow ? _getVal(tasikStockRow, pc.stockCol) : 0;
        var stockVal2 = whpTasikRow ? _getVal(whpTasikRow, pc.stockCol) : 0;
        var sumStock = stockVal1 + stockVal2;
        var selisih = bizVal - sumStock;
        if (Math.abs(selisih) > 0.1) {
          totalTasik += Math.abs(selisih);
          tasikIssues.push({
            produk: pc.bizName,
            biz: Number(bizVal).toLocaleString('id-ID'),
            excel: Number(sumStock).toLocaleString('id-ID'),
            selisih: Number(selisih).toLocaleString('id-ID')
          });
        }
      }
      report.push({
        cabang: "KONSOLIDASI WHP & WHO TASIKMALAYA",
        status: tasikIssues.length === 0 ? "MATCH" : "MISMATCH",
        totalSelisih: totalTasik,
        details: tasikIssues
      });
    }

    // Konsolidasi Bandung: BIZ[GUDANG BANDUNG] vs STOCK[WHP BANDUNG]
    if (bandungBizRow || whpBandungRow) {
      var bandungIssues = [];
      var totalBandung = 0;
      for (var k = 0; k < productCols.length; k++) {
        var pc = productCols[k];
        var bizVal = bandungBizRow ? _getVal(bandungBizRow, pc.bizCol) : 0;
        var stockVal = whpBandungRow ? _getVal(whpBandungRow, pc.stockCol) : 0;
        var selisih = bizVal - stockVal;
        if (Math.abs(selisih) > 0.1) {
          totalBandung += Math.abs(selisih);
          bandungIssues.push({
            produk: pc.bizName,
            biz: Number(bizVal).toLocaleString('id-ID'),
            excel: Number(stockVal).toLocaleString('id-ID'),
            selisih: Number(selisih).toLocaleString('id-ID')
          });
        }
      }
      report.push({
        cabang: "WHP BANDUNG",
        status: bandungIssues.length === 0 ? "MATCH" : "MISMATCH",
        totalSelisih: totalBandung,
        details: bandungIssues
      });
    }

    return report;
  } catch (err) {
    return { error: err.message };
  }
}

// ──── LOGIN ─────────────────────────────────────────────────────────────────
var USERS = {
  'superadmin': { passwordHash: _hashPw('admin123'), role: 'super_admin', name: 'Super Admin' },
  'admin':      { passwordHash: _hashPw('admin456'), role: 'admin',      name: 'Admin' }
};

function _hashPw(pw) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    hex += ('0' + (digest[i] & 0xFF).toString(16)).slice(-2);
  }
  return hex;
}

function loginUser(username, password) {
  var user = USERS[username.toLowerCase().trim()];
  if (!user) return { status: 'error', message: 'Username tidak ditemukan' };
  if (_hashPw(password) !== user.passwordHash) return { status: 'error', message: 'Password salah' };
  return { status: 'success', role: user.role, name: user.name };
}