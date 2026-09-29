import assert from 'node:assert/strict';

// Menghapus kolom % dari Bandingkan Belanja (29 Sep 2026). Risiko utama
// perubahan ini bukan "kolomnya hilang", tapi baris tidak lagi lurus dengan
// header karena ada colspan yang lupa dikecilkan. Test ini memanggil render
// sungguhan lewat loadBandingkanBelanja() dengan document tiruan, lalu
// menghitung <th> dan <td> yang benar-benar dihasilkan.

const elements = {};
function el(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
      classList: { add() {}, remove() {} },
      querySelectorAll: () => [],
      add() {},
      addEventListener() {},
      appendChild() {},
    };
  }
  return elements[id];
}
globalThis.document = { getElementById: el, querySelectorAll: () => [] };
globalThis.alert = () => {};
globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };

function fixture(punyaNama) {
  return {
    status: 'success',
    data: {
      bulan_ini: '2026-09',
      bulan_banding: '2026-08',
      nama_bulan_ini: 'September 2026',
      nama_bulan_banding: 'Agustus 2026',
      bulan_tanpa_nama: [],
      punya_nama: punyaNama,
      rows: [
        { nama_customer: 'PT Sinergi', tipe: 'Master Stokis', cabang: 'BANDUNG', pemilik: 'Budi', kontak: '08123456789', ini_bungkus: 100, banding_bungkus: 50 },
        { nama_customer: 'CV Maju', tipe: 'Stokis', cabang: 'BANDUNG', pemilik: 'Sari', kontak: '08129876543', ini_bungkus: 20, banding_bungkus: 40 },
      ],
    },
  };
}

const { loadBandingkanBelanja } = await import('../src/modules/reports/bandingkanBelanja.js');

function hitung(html, tag) {
  return [...html.matchAll(new RegExp('<' + tag + '\\b', 'g'))].length;
}
function hitungColspan(html) {
  return [...html.matchAll(/colspan="(\d+)"/g)].map(m => Number(m[1]));
}

async function render(punyaNama) {
  for (const k of Object.keys(elements)) delete elements[k];
  el('banding-bulan-ini').value = '2026-09';
  el('banding-bulan-banding').value = '2026-08';
  el('banding-cabang').value = 'ALL';
  globalThis.fetch = async () => ({ ok: true, json: async () => fixture(punyaNama) });
  await loadBandingkanBelanja();
  return {
    head: el('banding-thead').innerHTML,
    body: el('banding-tbody').innerHTML,
    foot: el('banding-tfoot').innerHTML,
    warn: el('banding-warning-text').textContent,
  };
}

for (const punyaNama of [true, false]) {
  const label = punyaNama ? 'punyaNama=true' : 'punyaNama=false';
  const Expected = punyaNama ? 9 : 7; // Nama, Tipe, Cabang, [Pemilik, Kontak], Total x2, Selisih, Tren
  const { head, body, foot } = await render(punyaNama);

  // 1. Kolom % benar-benar hilang.
  const thCount = hitung(head, 'th');
  assert.equal(thCount, Expected, label + ': jumlah <th> header');
  assert.ok(!/>%<\/th>/.test(head), label + ': header "%" harus hilang');
  assert.ok(head.includes('>Tren<'), label + ': kolom Tren harus tetap ada');
  // Selisih dirender lewat thSort(), jadi ada panah sort setelah teksnya.
  assert.ok(head.includes('>Selisih'), label + ': kolom Selisih harus tetap ada');

  // 2. Tidak ada sel yang masih menampilkan persen, termasuk nilai +12.5%.
  assert.ok(!/[-+]?\d+(\.\d+)?%/.test(body), label + ': tidak boleh ada nilai persen di tbody');
  assert.ok(!/[-+]?\d+(\.\d+)?%/.test(head), label + ': tidak boleh ada nilai persen di thead');
  assert.ok(!/[-+]?\d+(\.\d+)?%/.test(foot), label + ': tidak boleh ada nilai persen di tfoot');

  // 3. Tiap <tr> punya lebar kolom yang sama dengan header -- inilah yang
  //    menjamin kolom tidak bergeser.
  const baris = body.split('<tr').slice(1);
  assert.ok(baris.length >= 4, label + ': harus ada baris cabang, data, subtotal');
  baris.forEach((tr, i) => {
    const td = hitung(tr, 'td');
    const spans = hitungColspan(tr);
    const lebar = td + spans.reduce((s, c) => s + c - 1, 0);
    assert.equal(lebar, Expected, label + ': baris #' + (i + 1) + ' lebar ' + lebar + ' != ' + Expected);
  });

  // 4. Baris CABANG dan GRAND TOTAL memakai colspan penuh.
  const cab = body.split('<tr').find(tr => tr.includes('CABANG:'));
  assert.deepEqual(hitungColspan(cab), [Expected], label + ': baris CABANG');
  // Sel Tren terakhir sengaja tanpa atribut colspan.
  assert.deepEqual(hitungColspan(foot), [3, ...(punyaNama ? [2] : [])], label + ': baris GRAND TOTAL');

  // 5. Lebar GRAND TOTAL juga harus sama dengan header.
  const footTd = hitung(foot, 'td');
  const footSpans = hitungColspan(foot);
  const footWidth = footTd + footSpans.reduce((s, c) => s + c - 1, 0);
  assert.equal(footWidth, Expected, label + ': lebar GRAND TOTAL ' + footWidth + ' != ' + Expected);
}

// 5. Catatan peringatan tidak lagi menyebut kolom % yang sudah tidak ada.
{
  const { warn } = await render(false);
  assert.ok(warn.length > 0, 'peringatan harus tampil saat punyaNama=false');
  assert.ok(!warn.includes('%'), 'catatan peringatan tidak boleh menyebut kolom %');
  assert.ok(warn.includes('Selisih') && warn.includes('Tren'), 'catatan tetap menyebut Selisih dan Tren');
}

console.log('OK: tes bandingkan-belanja tanpa kolom persen lolos');
