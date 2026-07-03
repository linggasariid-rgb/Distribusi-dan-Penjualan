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
// Pakai createTemplateFromFile (bukan createHtmlOutputFromFile) supaya file yang
// di-include juga bisa berisi <?!= include('lain'); ?> bersarang (nested include).
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}
