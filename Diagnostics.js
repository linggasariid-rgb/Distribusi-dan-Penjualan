/**
 * Diagnostic sekali-pakai untuk mengukur ukuran JSON data sheet,
 * dibandingkan batas CacheService (100KB/key), untuk verifikasi fix cache.
 */
function logCacheSizeDiagnostics() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Update-Penjualan WHO");
  if (!sheet) {
    Logger.log("Sheet 'Update-Penjualan WHO' tidak ditemukan.");
    return;
  }
  var data = sheet.getDataRange().getValues();
  var json = JSON.stringify(data);
  var rawBytes = Utilities.newBlob(json).getBytes().length;
  var gzipBytes = Utilities.gzip(Utilities.newBlob(json)).getBytes().length;
  var base64Bytes = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(json)).getBytes()).length;

  Logger.log("=== Diagnostic: Update-Penjualan WHO ===");
  Logger.log("Jumlah baris: " + data.length);
  Logger.log("Ukuran JSON mentah: " + rawBytes + " bytes");
  Logger.log("Ukuran setelah gzip (raw bytes): " + gzipBytes + " bytes");
  Logger.log("Ukuran setelah gzip + base64 (yang disimpan ke cache): " + base64Bytes + " bytes");
  Logger.log("Batas CacheService per key: 102400 bytes (100KB)");
  Logger.log("Muat ke cache TANPA gzip? " + (rawBytes < 102400));
  Logger.log("Muat ke cache DENGAN gzip+base64? " + (base64Bytes < 102400));
}
