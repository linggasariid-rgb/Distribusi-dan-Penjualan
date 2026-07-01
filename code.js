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
  LEAD_TIME: {
    "BANDUNG": 1, "PURWAKARTA": 2, "KARAWANG": 2, "SUKABUMI": 2,
    "BOGOR": 2, "TANGERANG": 3, "SERANG": 4,
    "TASIKMALAYA": 1, "GARUT": 3, "CIREBON": 3
  },
  LIBUR_NASIONAL: [
    "2026-01-01", "2026-01-16", "2026-02-17", "2026-03-19",
    "2026-03-21", "2026-03-22", "2026-04-03", "2026-04-05",
    "2026-05-01", "2026-05-14", "2026-05-27", "2026-05-31",
    "2026-06-01", "2026-06-16", "2026-08-17", "2026-08-25", "2026-12-25"
  ]
};

function filterBranchesByWHP(result, userWHP) {
  if (!userWHP || !CONFIG.WHP_MAPPING[userWHP]) return result;
  var allowed = CONFIG.WHP_MAPPING[userWHP];
  var filtered = {};
  for (var key in result) {
    if (allowed.some(function(b) { return key.indexOf(b) !== -1; })) {
      filtered[key] = result[key];
    }
  }
  return filtered;
}

function filterBranchListByWHP(branches, userWHP) {
  if (!userWHP || !CONFIG.WHP_MAPPING[userWHP]) return branches;
  var allowed = CONFIG.WHP_MAPPING[userWHP];
  return branches.filter(function(b) {
    return allowed.some(function(c) { return b.indexOf(c) !== -1; });
  });
}

/**
 * Helper: baca data sheet dengan cache (5 menit TTL).
 * Mengurangi pembacaan ulang sheet yang sama antar fungsi.
 */
function getSheetDataCached(sheetName) {
  var cache = CacheService.getScriptCache();
  var key = 'sd_' + sheetName.replace(/[^a-zA-Z0-9]/g, '_');
  var cached = cache.get(key);
  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.length > 0) return parsed;
    } catch(e) {}
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan.");
  var data = sheet.getDataRange().getValues();
  try {
    cache.put(key, JSON.stringify(data), 300);
  } catch(e) {
    // Data terlalu besar untuk cache — fallback without caching
  }
  return data;
}

function getDistributionData(userWHP) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName("Update-Penjualan WHO");
    const stockSheet = ss.getSheetByName("Update-STOCK");
    
    if (!salesSheet || !stockSheet) throw new Error("Sheet Penjualan atau Stock tidak ditemukan.");

    const productList = Object.keys(CONFIG.PRODUCT_INFO);
    const salesData = getSheetDataCached("Update-Penjualan WHO");
    const stockData = getSheetDataCached("Update-STOCK");
    
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
    let startDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    let result = {};
    let dailySales = {};

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
      if (!dailySales[cabangKey]) dailySales[cabangKey] = {};
      result[cabangKey].nama = String(row[1]).trim();
      
      productList.forEach(p => {
        let colIdx = productIdxMap[p].sales;
        if (colIdx > -1) {
          let rawVal = String(row[colIdx]).trim();
          let val = Number(rawVal.replace(/\./g, '')) || 0;
          if (!dailySales[cabangKey][p]) dailySales[cabangKey][p] = [];
          dailySales[cabangKey][p].push(val);
        }
      });
    }

    // Filter outlier per produk per cabang
    for (let cabangKey in dailySales) {
      if (!result[cabangKey]) continue;
      productList.forEach(p => {
        let ds = dailySales[cabangKey][p];
        if (!ds || ds.length === 0) return;
        if (ds.length >= 3) {
          let sorted = ds.slice().sort((a, b) => a - b);
          let highest = sorted[sorted.length - 1];
          let restSum = sorted.slice(0, -1).reduce((s, v) => s + v, 0);
          let restAvg = restSum / (ds.length - 1);
          if (highest > restAvg * 3) {
            result[cabangKey].produk[p].salesTotal = restSum;
            return;
          }
        }
        result[cabangKey].produk[p].salesTotal = ds.reduce((s, v) => s + v, 0);
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
        result: filterBranchesByWHP(result, userWHP), 
        productList, 
        productInfo: CONFIG.PRODUCT_INFO, 
        whpMapping: CONFIG.WHP_MAPPING, 
        specialRoundUp: CONFIG.SPECIAL_ROUND_UP,
        whpStockData: userWHP ? (function(){ var w={}; if(whpStockData[userWHP]) w[userWHP]=whpStockData[userWHP]; return w; })() : whpStockData,
        leadTime: CONFIG.LEAD_TIME
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

function savePastedDataBIZ(data) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const bizSheet = ss.getSheetByName("BIZ") || ss.getSheetByName(".BIZ");
        if (!bizSheet) throw new Error("Sheet 'BIZ' tidak ditemukan.");

        const lastCol = bizSheet.getLastColumn();
        if (lastCol === 0) throw new Error("Sheet BIZ kosong (tidak ada kolom).");

        // Preserve header row 4, data mulai row 5
        const DATA_START_ROW = 5;
        const maxRow = bizSheet.getMaxRows();

        // Hapus semua data existing dari row 5 ke bawah
        if (maxRow >= DATA_START_ROW) {
            bizSheet.getRange(DATA_START_ROW, 1, maxRow - DATA_START_ROW + 1, lastCol).clearContent();
        }

        // Deteksi apakah baris pertama adalah header (mengandung keyword header)
        const headerKeywords = ['BULAN', 'CABANG', 'TANGGAL', 'NO.', 'FAKTUR', 'CUSTOMER', 'GUDANG', 'NAMA'];
        const firstRow = data[0].map(v => String(v).trim().toUpperCase());
        const hasHeader = headerKeywords.some(kw => firstRow.some(v => v.indexOf(kw) !== -1));

        let sourceDataRows;
        if (hasHeader) {
            sourceDataRows = data.slice(1);
        } else {
            sourceDataRows = data;
        }

        if (sourceDataRows.length === 0) {
            throw new Error("Tidak ada baris data untuk disimpan.");
        }

        // Normalize row lengths
        const colCount = sourceDataRows[0].length;
        const dataToWrite = sourceDataRows.map(row => {
            const newRow = Array(colCount).fill('');
            for (let i = 0; i < row.length && i < colCount; i++) {
                newRow[i] = row[i];
            }
            return newRow;
        });

        bizSheet.getRange(DATA_START_ROW, 1, dataToWrite.length, dataToWrite[0].length).setValues(dataToWrite);

        return { status: "success", message: `Data BIZ berhasil disimpan (${dataToWrite.length} baris). Data lama sudah di-replace.` };

    } catch (e) {
        Logger.log(e);
        return { status: "error", message: e.toString() };
    }
}

function savePastedDataUpdateStock(data) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName("Update-STOCK");
        if (!sheet) throw new Error("Sheet 'Update-STOCK' tidak ditemukan.");

        // Data dimulai dari baris 2, kolom B (index 2, kolom ke-2)
        const DATA_START_ROW = 2;
        const DATA_START_COL = 2;

        // Deteksi apakah baris pertama adalah header (mengandung keyword header)
        const headerKeywords = ['BULAN', 'CABANG', 'TANGGAL', 'NO.', 'FAKTUR', 'CUSTOMER', 'GUDANG', 'NAMA'];
        const firstRow = data[0].map(v => String(v).trim().toUpperCase());
        const hasHeader = headerKeywords.some(kw => firstRow.some(v => v.indexOf(kw) !== -1));

        let sourceDataRows;
        if (hasHeader) {
            sourceDataRows = data.slice(1);
        } else {
            sourceDataRows = data;
        }

        if (sourceDataRows.length === 0) {
            throw new Error("Tidak ada baris data untuk disimpan.");
        }

        // Normalize row lengths & convert kosong/strip jadi angka 0
        const colCount = sourceDataRows[0].length;
        const dataToWrite = sourceDataRows.map(row => {
            const newRow = Array(colCount).fill(0);
            for (let i = 0; i < row.length && i < colCount; i++) {
                const val = String(row[i]).trim();
                if (val === '' || val === '-' || val === '–' || val === '—') {
                    newRow[i] = 0;
                } else {
                    const num = Number(val.replace(/\./g, ''));
                    newRow[i] = isNaN(num) ? 0 : num;
                }
            }
            return newRow;
        });

        // Tulis data mulai baris 2, kolom B
        sheet.getRange(DATA_START_ROW, DATA_START_COL, dataToWrite.length, dataToWrite[0].length).setValues(dataToWrite);

        return { status: "success", message: `Data stok berhasil disimpan (${dataToWrite.length} baris).` };

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
function savePenerimaanPabrik(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Penerimaan");
    if (!sheet) {
      sheet = ss.insertSheet("Penerimaan");
      sheet.appendRow(["TANGGAL", "GUDANG", "JUMLAH"]);
    }

    const sourceHeader = data[0].map(h => String(h).trim().toUpperCase());
    const sourceRows = data.slice(1);

    const tglIdx = sourceHeader.findIndex(h => h.includes('TANGGAL'));
    const gudangIdx = sourceHeader.findIndex(h => h.includes('GUDANG'));
    const jumlahIdx = sourceHeader.findIndex(h => h.includes('JUMLAH'));

    if (tglIdx === -1 || gudangIdx === -1 || jumlahIdx === -1) {
      throw new Error("Header harus mengandung: TANGGAL, GUDANG, JUMLAH. Ditemukan: " + sourceHeader.join(", "));
    }

    const rowsToAdd = [];
    sourceRows.forEach(row => {
      const tgl = row[tglIdx] ? String(row[tglIdx]).trim() : '';
      const gudang = row[gudangIdx] ? String(row[gudangIdx]).trim() : '';
      const jumlah = row[jumlahIdx] !== undefined && row[jumlahIdx] !== '' ? Number(String(row[jumlahIdx]).replace(/\./g, '')) || 0 : 0;
      if (tgl && gudang) {
        rowsToAdd.push([tgl, gudang.toUpperCase(), jumlah]);
      }
    });

    if (rowsToAdd.length === 0) {
      throw new Error("Tidak ada baris data valid untuk disimpan.");
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 3).setValues(rowsToAdd);

    CacheService.getScriptCache().remove('sd_Penerimaan');
    return { status: "success", message: `Data penerimaan pabrik berhasil disimpan (${rowsToAdd.length} baris).` };
  } catch (e) {
    Logger.log(e);
    return { status: "error", message: e.toString() };
  }
}

function saveDistribusi(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Distribusi");
    if (!sheet) {
      sheet = ss.insertSheet("Distribusi");
      sheet.appendRow(["TANGGAL", "GUDANG", "CABANG", "JUMLAH"]);
    }

    const sourceHeader = data[0].map(h => String(h).trim().toUpperCase());
    const sourceRows = data.slice(1);

    const tglIdx = sourceHeader.findIndex(h => h.includes('TANGGAL'));
    const gudangIdx = sourceHeader.findIndex(h => h.includes('GUDANG'));
    const cabangIdx = sourceHeader.findIndex(h => h.includes('CABANG'));
    const jumlahIdx = sourceHeader.findIndex(h => h.includes('JUMLAH'));

    if (tglIdx === -1 || gudangIdx === -1 || cabangIdx === -1 || jumlahIdx === -1) {
      throw new Error("Header harus mengandung: TANGGAL, GUDANG, CABANG, JUMLAH. Ditemukan: " + sourceHeader.join(", "));
    }

    const rowsToAdd = [];
    sourceRows.forEach(row => {
      const tgl = row[tglIdx] ? String(row[tglIdx]).trim() : '';
      const gudang = row[gudangIdx] ? String(row[gudangIdx]).trim() : '';
      const cabang = row[cabangIdx] ? String(row[cabangIdx]).trim() : '';
      const jumlah = row[jumlahIdx] !== undefined && row[jumlahIdx] !== '' ? Number(String(row[jumlahIdx]).replace(/\./g, '')) || 0 : 0;
      if (tgl && gudang && cabang) {
        rowsToAdd.push([tgl, gudang.toUpperCase(), cabang.toUpperCase(), jumlah]);
      }
    });

    if (rowsToAdd.length === 0) {
      throw new Error("Tidak ada baris data valid untuk disimpan.");
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 4).setValues(rowsToAdd);

    CacheService.getScriptCache().remove('sd_Distribusi');
    return { status: "success", message: `Data distribusi berhasil disimpan (${rowsToAdd.length} baris).` };
  } catch (e) {
    Logger.log(e);
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
    const distRows = getSheetDataCached("Distribusi");
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
    const recRows = getSheetDataCached("Penerimaan");
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

    var bizData = getSheetDataCached("BIZ");
    var stockData = getSheetDataCached("Update-STOCK");

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
        kpis: { delta: delta, growthPct: growthPct, currentTotal: currentTotal, previousTotal: previousTotal },
        dateSnapshots: dateSnapshots,
        branches: allBranches,
        dailyComparison: dailyComparison
      }
    };

  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// ──── USER MANIFEST ─────────────────────────────────────────────────────────
//
// Role & Akses:
//   super_admin → Semua menu & semua cabang (10 cabang)
//   admin       → Menu: distribusi, stok + semua cabang
//   admin_whp   → Menu: distribusi, stok + cabang sesuai WHP
//
// WHP Mapping:
//   WHP BANDUNG      → Bandung, Purwakarta, Karawang, Sukabumi, Bogor, Tangerang, Serang
//   WHP TASIKMALAYA  → Tasikmalaya, Garut, Cirebon
//
// Akun:
//   superadmin  / admin123   → super_admin (full akses)
//   admin       / admin456   → admin (semua cabang)
//   whp_tasik   / tasik123   → admin_whp (Tasikmalaya, Garut, Cirebon)
//   whp_bandung / bandung123 → admin_whp (Bandung, Purwakarta, ..., Serang)
// ─────────────────────────────────────────────────────────────────────────────
var USERS = {
  'superadmin':  { passwordHash: _hashPw('admin123'),  role: 'super_admin', name: 'Super Admin',       whp: null },
  'admin':       { passwordHash: _hashPw('admin456'),  role: 'admin',       name: 'Admin',            whp: null },
  'whp_tasik':   { passwordHash: _hashPw('tasik123'),  role: 'admin_whp',   name: 'Admin WHP Tasikmalaya', whp: 'WHP TASIKMALAYA' },
  'whp_bandung': { passwordHash: _hashPw('bandung123'), role: 'admin_whp',  name: 'Admin WHP Bandung',     whp: 'WHP BANDUNG' }
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
  return { status: 'success', role: user.role, name: user.name, whp: user.whp };
}