export const CONFIG = {
  PRODUCT_INFO: {
    "SPS TSI":    { ctn: 1000, targetStock: 8 },
    "SKM TSI":    { ctn: 1000, targetStock: 8 },
    "SM":         { ctn: 1000, targetStock: 8 },
    "SP19 TSI":   { ctn: 500,  targetStock: 8 },
    "SPF":        { ctn: 1000, targetStock: 8 },
    "SMM":        { ctn: 1000, targetStock: 8 },
    "ST":         { ctn: 700,  targetStock: 8 },
    "SSJ":        { ctn: 1000, targetStock: 8 },
    "STM":        { ctn: 700,  targetStock: 8 },
    "SKMF":       { ctn: 1000, targetStock: 8 },
    "SK":         { ctn: 320,  targetStock: 8 },
    "SNN ORG":    { ctn: 1000, targetStock: 8 },
    "SNN Mind":   { ctn: 1000, targetStock: 8 },
    "SNN Menthol":{ ctn: 700,  targetStock: 8, alias: "SNNM" },
    "SPW":        { ctn: 500,  targetStock: 8 },
    "SP":         { ctn: 500,  targetStock: 8 },
    "KMK":        { ctn: 40,   targetStock: 8 },
    "KOOR":       { ctn: 40,   targetStock: 8, alias: "KO" },
    "SSE":        { ctn: 1000, targetStock: 8 },
    "HU":         { ctn: 10,   targetStock: 8 },
  },
  SPECIAL_ROUND_UP: ["SP19 TSI", "SKM TSI", "SSJ", "SNN ORG"],
  CABANG_FULL_TIME: ["BOGOR", "TANGERANG", "SUKABUMI", "TASIKMALAYA", "KARAWANG", "BANDUNG"],
  WHP_MAPPING: {
    "WHP BANDUNG": ["BANDUNG", "PURWAKARTA", "KARAWANG", "SUKABUMI", "BOGOR", "TANGERANG", "SERANG"],
    "WHP TASIKMALAYA": ["TASIKMALAYA", "GARUT", "CIREBON"],
  },
  IGNORE_BRANCHES: ["WHP BANDUNG", "WHP TASIKMALAYA", "TOTAL", "GRAND TOTAL", "TOTAL KESELURUHAN", "BANYUMAS"],
  // Dipakai khusus di sales-report.js (Laporan Harian/Pertanggal) -- daftar berbeda dari IGNORE_BRANCHES,
  // sengaja tidak termasuk BANYUMAS, cocok dengan Sales.js legacy (matching by substring, bukan exact).
  IGNORE_BRANCHES_REPORT: ["WHP", "TOTAL", "GRAND TOTAL", "TOTAL KESELURUHAN"],
  LEAD_TIME: {
    "BANDUNG": 1, "PURWAKARTA": 2, "KARAWANG": 2, "SUKABUMI": 2,
    "BOGOR": 2, "TANGERANG": 3, "SERANG": 4,
    "TASIKMALAYA": 1, "GARUT": 3, "CIREBON": 3,
  },
  LIBUR_NASIONAL: [
    "2026-01-01", "2026-01-16", "2026-02-17", "2026-03-19",
    "2026-03-21", "2026-03-22", "2026-04-03", "2026-04-05",
    "2026-05-01", "2026-05-14", "2026-05-27", "2026-05-31",
    "2026-06-01", "2026-06-16", "2026-08-17", "2026-08-25", "2026-12-25",
  ],
  BIZ_PRODUCT_MAP: {
    "Sin Platinum Special": "SPS TSI", "Sin Kujang Mas": "SKM TSI",
    "Sinergi Mind": "SM", "Sin Provost 19": "SP19 TSI",
    "Sin Platinum Filter": "SPF", "Sinergi Mind Menthol": "SMM",
    "Sin Trust": "ST", "Sin Sapu Jagat": "SSJ",
    "Sin Trust Menthol": "STM", "Sin Kujang Mas Filter": "SKMF",
    "Sin Krakatau": "SK", "Sin New Normal Org": "SNN ORG",
    "Sin New Normal Mind": "SNN Mind", "Sin New Normal Menthol": "SNN Menthol",
    "Kartu Hu versi Baru": "HU", "Kopi Mana Kopi": "KMK",
    "Kopi Original": "KOOR", "SIN Precision White": "SPW",
    "SIN Precision": "SP", "SIN Encode": "SSE",
  },
};

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(str) {
  if (!str) return null;
  if (str.includes('/')) {
    const p = str.split('/');
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  }
  if (str.includes('-')) {
    const p = str.split('-');
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  }
  return null;
}

// Cocokkan header kolom produk secara case-insensitive + trim, dengan fallback ke alias
// (mis. "SNNM" untuk SNN Menthol, "KO" untuk KOOR). Mengembalikan hanya produk yang
// benar-benar ketemu kolomnya -- {productKey: columnIndex}.
export function buildProductColumnMap(headers) {
  const normalized = headers.map(h => String(h || '').trim().toUpperCase().replace(/\s+/g, ' '));
  const map = {};
  for (const [key, info] of Object.entries(CONFIG.PRODUCT_INFO)) {
    const candidates = [key.toUpperCase()];
    if (info.alias) candidates.push(info.alias.toUpperCase());
    let idx = -1;
    for (const cand of candidates) {
      idx = normalized.indexOf(cand);
      if (idx >= 0) break;
    }
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

const DAY_MS = 86400 * 1000;

// Jumlah hari kerja efektif dalam window mundur `windowDays` hari dari `endDate` (inklusif):
// cabang full-time dihitung penuh (semua hari kalender), cabang lain mengecualikan
// hari Minggu & libur nasional. Port dari Distribution.js:173-188 (GAS legacy).
export function calculateWorkDays(cabang, endDate, windowDays) {
  const isFullTime = CONFIG.CABANG_FULL_TIME.includes(cabang);
  if (isFullTime) return windowDays;
  let count = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(endDate.getTime() - i * DAY_MS);
    if (d.getDay() === 0) continue; // Minggu
    if (CONFIG.LIBUR_NASIONAL.includes(toDateStr(d))) continue;
    count++;
  }
  return count;
}

export function filterBranchesByWHP(branches, whp) {
  if (!whp || whp === 'ALL') return branches;
  const allowed = CONFIG.WHP_MAPPING[whp] || [];
  return branches.filter(b => allowed.includes(b));
}

export function getTipeLabel(tipe) {
  const map = {
    'MST': 'Master Stokis',
    'STK': 'Stokis',
    'KARYAWAN': 'Karyawan',
    'TSIAPPS': 'TSI Apps',
    'MSI': 'MSI',
  };
  return map[tipe] || tipe;
}

export function formatNumber(n) {
  return n.toLocaleString('id-ID');
}
