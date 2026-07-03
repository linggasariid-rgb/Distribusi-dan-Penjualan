/**
 * Wrapper Gemini API (model gemini-2.0-flash, gratis).
 * API key disimpan di Script Properties, tidak pernah dikirim ke client.
 */
function getGeminiApiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    throw new Error('GEMINI_API_KEY belum di-set. Jalankan setGeminiApiKey("API_KEY_ANDA") sekali dari editor Apps Script (pilih fungsi setGeminiApiKey, isi parameter lewat panggilan manual atau ubah sementara jadi hardcoded lalu jalankan sekali, lalu hapus lagi).');
  }
  return key;
}

function setGeminiApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
  Logger.log('GEMINI_API_KEY berhasil disimpan ke Script Properties.');
}

/**
 * Panggil Gemini generateContent API.
 * @param {Array} contents - array {role, parts:[{text}]} sesuai format Gemini.
 * @param {Array|null} tools - array tool declarations untuk function-calling, atau null.
 * @return {Object} content object dari candidate pertama: {role, parts:[...]}
 */
function callGemini_(contents, tools) {
  var apiKey = getGeminiApiKey_();
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
  var payload = { contents: contents };
  if (tools) payload.tools = tools;

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code !== 200) {
    var msg = (body.error && body.error.message) ? body.error.message : ('HTTP ' + code);
    throw new Error('Gemini API error: ' + msg);
  }
  if (!body.candidates || !body.candidates.length) {
    throw new Error('Gemini API tidak mengembalikan kandidat jawaban.');
  }
  return body.candidates[0].content;
}

function chatWithSalesAI(pesan, riwayat, userWHP) {
  try {
    var tools = [{
      functionDeclarations: [
        {
          name: 'getSalesDashboardData',
          description: 'Ambil ringkasan dashboard penjualan (total bulan ini, bulan lalu, hari ini) per WHP/cabang.',
          parameters: {
            type: 'OBJECT',
            properties: {
              filterWHO: { type: 'STRING', description: 'Nama WHP, mis. "WHP BANDUNG" atau "WHP TASIKMALAYA", atau "ALL" untuk semua.' },
              filterBranch: { type: 'STRING', description: 'Nama cabang spesifik, atau "ALL" untuk semua cabang.' }
            }
          }
        },
        {
          name: 'getBestProductsData',
          description: 'Ambil daftar produk terlaris pada bulan tertentu.',
          parameters: {
            type: 'OBJECT',
            properties: {
              filterMonth: { type: 'STRING', description: 'Bulan dalam format YYYY-MM, mis. "2026-07". Kosongkan untuk bulan berjalan.' }
            }
          }
        },
        {
          name: 'getSalesDailyReport',
          description: 'Ambil laporan penjualan harian per cabang dalam rentang bulan tertentu.',
          parameters: {
            type: 'OBJECT',
            properties: {
              filterMonth: { type: 'STRING', description: 'Bulan akhir laporan, format YYYY-MM.' },
              startMonth: { type: 'STRING', description: 'Bulan awal laporan, format YYYY-MM.' }
            }
          }
        },
        {
          name: 'getSalesHubData',
          description: 'Bandingkan total penjualan antara dua tanggal spesifik.',
          parameters: {
            type: 'OBJECT',
            properties: {
              currDateStr: { type: 'STRING', description: 'Tanggal pembanding utama, format YYYY-MM-DD.' },
              prevDateStr: { type: 'STRING', description: 'Tanggal pembanding sebelumnya, format YYYY-MM-DD.' }
            }
          }
        }
      ]
    }];

    var historyContents = (riwayat || []).slice(-10).map(function(h) {
      return { role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] };
    });
    var systemNote = 'Kamu adalah asisten data penjualan untuk aplikasi distribusi. Jawab HANYA seputar data penjualan (dashboard, produk terlaris, laporan harian, perbandingan penjualan). Gunakan salah satu tool yang tersedia untuk mengambil data nyata sebelum menjawab, jangan mengarang angka. Jawab dalam Bahasa Indonesia yang ramah dan ringkas.';
    var contents = [{ role: 'user', parts: [{ text: systemNote }] }]
      .concat(historyContents)
      .concat([{ role: 'user', parts: [{ text: pesan }] }]);

    var firstResult = callGemini_(contents, tools);
    var firstPart = firstResult.parts && firstResult.parts[0];

    if (!firstPart || !firstPart.functionCall) {
      var directText = (firstPart && firstPart.text) ? firstPart.text : 'Maaf, saya tidak bisa memproses pertanyaan itu.';
      return { status: 'success', message: directText };
    }

    var fnName = firstPart.functionCall.name;
    var args = firstPart.functionCall.args || {};
    var fnResult = _dispatchSalesTool_(fnName, args, userWHP);

    var secondContents = contents.concat([
      { role: 'model', parts: [{ functionCall: firstPart.functionCall }] },
      { role: 'user', parts: [{ functionResponse: { name: fnName, response: fnResult } }] }
    ]);
    var secondResult = callGemini_(secondContents, tools);
    var secondPart = secondResult.parts && secondResult.parts[0];
    var finalText = (secondPart && secondPart.text) ? secondPart.text : 'Maaf, saya tidak bisa menyusun jawaban.';

    return { status: 'success', message: finalText };
  } catch (e) {
    Logger.log(e);
    return { status: 'error', message: e.toString() };
  }
}

function _dispatchSalesTool_(fnName, args, userWHP) {
  if (fnName === 'getSalesDashboardData') {
    return getSalesDashboardData(args.filterWHO || 'ALL', args.filterBranch || 'ALL', userWHP);
  }
  if (fnName === 'getBestProductsData') {
    return getBestProductsData(args.filterMonth || null);
  }
  if (fnName === 'getSalesDailyReport') {
    return getSalesDailyReport(-1, args.filterMonth || null, args.startMonth || null, userWHP);
  }
  if (fnName === 'getSalesHubData') {
    var today = new Date();
    var defaultCurr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return getSalesHubData(userWHP, args.currDateStr || defaultCurr, args.prevDateStr || defaultCurr, '');
  }
  return { error: 'Tool tidak dikenal: ' + fnName };
}
