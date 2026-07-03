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
      invalidateSheetCache_(targetSheetName);
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
        invalidateSheetCache_("Update-Penjualan WHO");

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
        invalidateSheetCache_("BIZ");

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
        invalidateSheetCache_("Update-STOCK");

        return { status: "success", message: `Data stok berhasil disimpan (${dataToWrite.length} baris).` };

    } catch (e) {
        Logger.log(e);
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
        invalidateSheetCache_("Update-STOCK");
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
