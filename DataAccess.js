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
      var bytes = Utilities.base64Decode(cached);
      var json = Utilities.ungzip(Utilities.newBlob(bytes, 'application/x-gzip')).getDataAsString();
      var parsed = JSON.parse(json);
      if (parsed && parsed.length > 0) return parsed;
    } catch(e) {}
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' tidak ditemukan.");
  var data = sheet.getDataRange().getValues();
  try {
    var json = JSON.stringify(data);
    var gzipBytes = Utilities.gzip(Utilities.newBlob(json)).getBytes();
    var base64 = Utilities.base64Encode(gzipBytes);
    if (base64.length < 100000) {
      cache.put(key, base64, 300);
    } else {
      Logger.log("Cache dilewati untuk '" + sheetName + "': ukuran gzip+base64 " + base64.length + " bytes melebihi batas 100KB.");
    }
  } catch(e) {
    Logger.log("Gagal menyimpan cache untuk '" + sheetName + "': " + e.toString());
  }
  return data;
}

function invalidateSheetCache_(sheetName) {
  var key = 'sd_' + sheetName.replace(/[^a-zA-Z0-9]/g, '_');
  CacheService.getScriptCache().remove(key);
}
