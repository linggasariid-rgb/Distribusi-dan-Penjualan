// Helper export Excel (xlsx-js-style, global XLSX) yang dipakai bersama oleh
// menu laporan -- supaya semua file hasil export langsung rapi dengan gaya yang sama.

export function gayaBaris(ws, rIdx, nKolom, style) {
  for (let c = 0; c < nKolom; c++) {
    const ref = XLSX.utils.encode_cell({ c, r: rIdx });
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = style;
  }
}

export function formatAngka(ws) {
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    if (typeof ws[key].v === 'number') ws[key].z = '#,##0';
  }
}

export const GAYA_HEADER = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1E293B' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: { bottom: { style: 'thin', color: { rgb: '94A3B8' } } },
};

// Header dibungkus & rata tengah, tinggi baris cukup untuk 2 baris teks.
export function gayaHeader(ws, rIdx, nKolom) {
  gayaBaris(ws, rIdx, nKolom, GAYA_HEADER);
  const rowsMeta = ws['!rows'] || [];
  rowsMeta[rIdx] = { hpt: 32 };
  ws['!rows'] = rowsMeta;
}

// Rapikan tampilan sheet supaya langsung enak dibaca tanpa geser kolom manual:
// lebar kolom mengikuti isi terpanjang (judul di atas header tidak dihitung),
// header dibungkus & rata tengah, judul tebal, dan opsional autofilter.
// opsi.headerRow default 5: 5 baris judul (termasuk baris kosong) lalu header.
export function rapikanSheet(ws, aoa, opsi = {}) {
  const headerRow = opsi.headerRow == null ? 5 : opsi.headerRow;
  const nKolom = Math.max(...aoa.slice(headerRow).map(r => r.length), 1);
  const panjang = v => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return Math.abs(v).toLocaleString('id-ID').length + (v < 0 ? 1 : 0);
    return String(v).length;
  };
  const cols = [];
  for (let c = 0; c < nKolom; c++) {
    // Header boleh dibungkus, jadi yang menentukan lebar hanya kata terpanjangnya.
    const header = String((aoa[headerRow] || [])[c] || '');
    const kataHeader = Math.max(0, ...header.split(/\s+/).map(w => w.length));
    let isi = 0;
    for (let r = headerRow + 1; r < aoa.length; r++) {
      const baris = aoa[r] || [];
      // Baris catatan/judul bagian (hanya kolom A terisi) dibiarkan meluber, tidak ikut melebarkan.
      if (c === 0 && baris.length === 1) continue;
      isi = Math.max(isi, panjang(baris[c]));
    }
    cols.push({ wch: Math.min(Math.max(isi, kataHeader, 6) + 2, 45) });
  }
  ws['!cols'] = cols;

  gayaHeader(ws, headerRow, nKolom);

  // Judul laporan
  const judul = ws[XLSX.utils.encode_cell({ c: 0, r: 0 })];
  if (judul) judul.s = { font: { bold: true, sz: 14 } };
  const subjudul = ws[XLSX.utils.encode_cell({ c: 0, r: 1 })];
  if (subjudul) subjudul.s = { font: { bold: true, sz: 12 } };

  if (opsi.filter && aoa.length > headerRow + 1) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: headerRow }, e: { c: nKolom - 1, r: aoa.length - 1 } }) };
  }
}
