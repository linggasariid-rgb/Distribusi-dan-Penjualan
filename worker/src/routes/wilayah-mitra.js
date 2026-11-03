// Master wilayah mitra: kecamatan / kota per Master Stokis & MSI.
// Frontend sudah memilih kolom wilayah saja dari Excel (lihat
// ambilKolomWilayah() di omzetKecamatan.js), jadi body berisi objek
// { nama, desa, kecamatan, kota, provinsi } -- tanpa alamat, KTP, atau HP.

const GRUP_VALID = new Set(['MASTER', 'STOKIS']);

function clean(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

// "Az-Zahrah" -> "AZ-ZAHRAH". Penjualan memakai "MST Az-Zahrah", jadi sisi
// penjualan membuang awalan tipe dulu (lihat namaTanpaTipe() di omzet-kecamatan.js).
export function buildWilayahKey(nama) {
  return clean(nama).toUpperCase();
}

// "Kab. Garut" / "Kab Garut" / "KabupatenTasikmalaya" -> "Kabupaten Garut" dst.,
// supaya satu kabupaten tidak terpecah jadi dua grup di laporan.
export function normalizeKota(kota) {
  return clean(kota)
    .replace(/^kab(?:upaten|\.)?\s*/i, 'Kabupaten ')
    .replace(/^kota\s*/i, 'Kota ')
    .trim();
}

export function normalizeWilayahRows(rows) {
  const out = new Map();
  for (const r of rows || []) {
    if (!r || typeof r !== 'object') continue;
    const nama = clean(r.nama);
    if (!nama) continue;
    // Baris berikutnya dengan nama sama menimpa yang sebelumnya: upsert satu
    // request ditolak PostgREST kalau kunci yang sama muncul dua kali.
    out.set(buildWilayahKey(nama), {
      nama_key: buildWilayahKey(nama),
      nama,
      desa: clean(r.desa),
      kecamatan: clean(r.kecamatan),
      kota: normalizeKota(r.kota),
      provinsi: clean(r.provinsi),
    });
  }
  return [...out.values()];
}

export async function handleSummary(db) {
  const rows = await db.query('wilayah_mitra', { select: 'grup,updated_at' });
  const perGrup = {};
  let terakhir = null;
  for (const r of rows) {
    perGrup[r.grup] = (perGrup[r.grup] || 0) + 1;
    if (r.updated_at && (!terakhir || r.updated_at > terakhir)) terakhir = r.updated_at;
  }
  return { status: 'success', data: { total: rows.length, per_grup: perGrup, terakhir_update: terakhir } };
}

export async function handle(db, body) {
  const grup = String((body && body.grup) || 'MASTER').toUpperCase();
  if (!GRUP_VALID.has(grup)) {
    return { status: 'error', message: 'Grup tidak dikenal: ' + grup };
  }
  const dihapus = [...new Set(((body && body.dihapus) || []).map(buildWilayahKey).filter(Boolean))];
  const parsed = normalizeWilayahRows(body && body.rows).filter(p => !dihapus.includes(p.nama_key));
  if (parsed.length === 0) {
    return { status: 'error', message: 'Tidak ada baris mitra yang terbaca. Pastikan file punya kolom "Master Stokis" dan "Kecamatan".' };
  }

  // Mitra bertanda "Member dihapus" di Excel dibuang dari data wilayah, supaya
  // tidak ikut terdaftar sebagai "tidak belanja". Upsert saja tidak cukup
  // karena upsert tidak pernah menghapus baris lama.
  for (const nama_key of dihapus) {
    await db.request('DELETE', 'wilayah_mitra', { eq: { grup, nama_key } });
  }

  const now = new Date().toISOString();
  // Batch supaya body request tidak terlalu besar untuk ribuan mitra.
  const BATCH = 500;
  for (let i = 0; i < parsed.length; i += BATCH) {
    await db.request('POST', 'wilayah_mitra', {
      data: parsed.slice(i, i + BATCH).map(p => ({ ...p, grup, updated_at: now })),
      onConflict: 'grup,nama_key',
    });
  }
  return { status: 'success', data: { saved: parsed.length, dihapus: dihapus.length, grup } };
}
