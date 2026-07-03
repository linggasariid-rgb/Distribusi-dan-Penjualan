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
