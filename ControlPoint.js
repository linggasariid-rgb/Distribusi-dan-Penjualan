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
      if (v === undefined || v === null || v === '' || v === '-') return 0;
      var cleaned = String(v).trim().replace(/\./g, '');
      var num = Number(cleaned);
      return isNaN(num) ? 0 : num;
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
