export async function handle(db, body) {
  const data = body.data;
  if (!Array.isArray(data) || data.length < 2) {
    return { status: 'error', message: 'Data kosong atau tidak valid' };
  }

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || r.length < 3) continue;
    if (!r[0] || !r[1] || !r[2]) continue;

    const tgl = String(r[0]).trim();
    const parts = tgl.split('/');
    if (parts.length !== 3) continue;
    const tanggal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;

    rows.push({
      tanggal,
      gudang: String(r[1]).trim(),
      jumlah: parseInt(String(r[2]).replace(/\./g, '')) || 0,
    });
  }

  if (rows.length === 0) {
    return { status: 'error', message: 'Tidak ada baris data valid' };
  }

  // Proteksi submit ganda: buang baris yang identik (tanggal+gudang+jumlah) dengan yang
  // sudah ada, supaya tombol simpan yang tertekan dua kali tidak menggandakan data.
  const dates = [...new Set(rows.map(r => r.tanggal))].sort();
  const existing = await db.query('penerimaan', {
    select: 'tanggal,gudang,jumlah',
    gte: { tanggal: dates[0] },
    lte: { tanggal: dates[dates.length - 1] },
  });
  const sig = r => `${r.tanggal}|${r.gudang}|${r.jumlah}`;
  const seen = new Set(existing.map(sig));

  const rowsToInsert = [];
  let skipped = 0;
  for (const row of rows) {
    const s = sig(row);
    if (seen.has(s)) { skipped++; continue; }
    seen.add(s);
    rowsToInsert.push(row);
  }

  if (rowsToInsert.length === 0) {
    return { status: 'error', message: `Semua ${rows.length} baris sudah pernah tersimpan sebelumnya (terdeteksi duplikat)` };
  }

  await db.request('POST', 'penerimaan', { data: rowsToInsert });
  const msg = skipped > 0
    ? `${rowsToInsert.length} baris data penerimaan pabrik berhasil disimpan (${skipped} baris duplikat dilewati)`
    : `${rowsToInsert.length} baris data penerimaan pabrik berhasil disimpan`;
  return { status: 'success', message: msg };
}
