export class Supabase {
  constructor(url, anonKey) {
    this.url = url.replace(/\/$/, '');
    this.headers = {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    };
  }

  async query(table, { select = '*', eq, inList, gte, lte, order, limit, range } = {}) {
    let path = `/rest/v1/${table}?select=${encodeURIComponent(select)}`;

    if (eq) {
      for (const [col, val] of Object.entries(eq)) {
        path += `&${col}=eq.${encodeURIComponent(val)}`;
      }
    }
    if (inList) {
      for (const [col, vals] of Object.entries(inList)) {
        path += `&${col}=in.(${vals.map(v => encodeURIComponent(v)).join(',')})`;
      }
    }
    if (gte) {
      for (const [col, val] of Object.entries(gte)) {
        path += `&${col}=gte.${encodeURIComponent(val)}`;
      }
    }
    if (lte) {
      for (const [col, val] of Object.entries(lte)) {
        path += `&${col}=lte.${encodeURIComponent(val)}`;
      }
    }
    if (order) path += `&order=${encodeURIComponent(order)}`;

    // Kalau caller minta limit/range eksplisit, hormati apa adanya (satu request).
    if (limit) return this._fetchJson(`${path}&limit=${limit}`);
    if (range) return this._fetchJson(`${path}&offset=${range[0]}&limit=${range[1] - range[0] + 1}`);

    // Kalau tidak ada limit eksplisit, PostgREST/Supabase diam-diam membatasi hasil
    // ke db-max-rows (default 1000) -- paginasi otomatis supaya query besar
    // (mis. seluruh riwayat penjualan_who) tidak terpotong tanpa disadari.
    const pageSize = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const page = await this._fetchJson(`${path}&offset=${from}&limit=${pageSize}`);
      all = all.concat(page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  async _fetchJson(path) {
    const res = await fetch(`${this.url}${path}`, { headers: this.headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  async request(method, table, { data, onConflict, select, eq, notNull } = {}) {
    let path = `/rest/v1/${table}`;
    // PostgREST menolak DELETE tanpa WHERE clause, jadi "hapus semua" harus
    // tetap menyertakan filter. Pakai `not.is.null` karena kolomnya NOT NULL,
    // sehingga match semua baris tanpa bergantung pada parsing nilai kosong.
    let qs = '';
    if (eq) {
      for (const [col, val] of Object.entries(eq)) {
        qs += `${qs ? '&' : '?'}${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`;
      }
    }
    if (notNull) {
      for (const col of notNull) {
        qs += `${qs ? '&' : '?'}${encodeURIComponent(col)}=not.is.null`;
      }
    }
    if (select) qs += `${qs ? '&' : '?'}select=${encodeURIComponent(select)}`;

    const headers = { ...this.headers, Prefer: 'return=minimal' };
    if (method === 'POST' && onConflict) {
      headers.Prefer = 'resolution=merge-duplicates';
      if (!qs) qs = `?on_conflict=${encodeURIComponent(onConflict)}`;
      else qs += `&on_conflict=${encodeURIComponent(onConflict)}`;
    }
    return this._fetch(path + qs, method, data, headers);
  }

  async _fetch(path, method, body, headers) {
    const opts = { method, headers };
    if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    const res = await fetch(`${this.url}${path}`, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
    }
    try { return await res.json(); } catch { return null; }
  }
}
