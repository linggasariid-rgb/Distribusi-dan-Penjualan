export async function handle(env, body) {
  const { pesan, riwayat, userWHP } = body;
  if (!pesan) {
    return { status: 'error', message: 'Pesan tidak boleh kosong' };
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return { status: 'error', message: 'AI tidak dikonfigurasi (GEMINI_API_KEY tidak tersedia)' };
  }

  const systemPrompt = `Kamu adalah asisten AI untuk Divisi Sales & Distribution PT. Tridaya Sinergi Indonesia.
Tugasmu membantu menganalisa data penjualan, distribusi, dan stok produk.
WHP user: ${userWHP || 'ALL'}
Produk: SPS TSI, SKM TSI, SM, SP19 TSI, SPF, SMM, ST, SSJ, STM, SKMF, SK, SNN ORG, SNN Mind, SNN Menthol, SPW, SP, KMK, KOOR, SSE, HU
Jawab dengan bahasa Indonesia yang singkat dan padat.`;

  const contents = [];
  contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
  contents.push({ role: 'model', parts: [{ text: 'Siap, saya akan membantu analisa data sales & distribution.' }] });

  if (Array.isArray(riwayat)) {
    for (const msg of riwayat.slice(-10)) {
      const role = msg.role === 'model' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: msg.text || '' }] });
    }
  }

  contents.push({ role: 'user', parts: [{ text: pesan }] });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { status: 'error', message: `AI API error: ${res.status}` };
    }

    const json = await res.json();
    const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, tidak ada respons dari AI.';

    return { status: 'success', message: reply };
  } catch (err) {
    return { status: 'error', message: 'Gagal terhubung ke AI: ' + err.message };
  }
}
