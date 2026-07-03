const CONFIG = {
  SPREADSHEET_ID: "1znxLIojUXuPNjL9O2b3l_knG6cgY0sSVmTeKh78Dwbw",
  PRODUCT_INFO: {
    "SPS TSI":    { ctn: 1000, targetStock: 8 },
    "SKM TSI":    { ctn: 1000, targetStock: 8 },
    "SM":         { ctn: 1000, targetStock: 8 },
    "SP19 TSI":   { ctn: 500, targetStock: 8 },
    "SPF":        { ctn: 1000, targetStock: 8 },
    "SMM":        { ctn: 1000, targetStock: 8 },
    "ST":         { ctn: 700, targetStock: 8 },
    "SSJ":        { ctn: 1000, targetStock: 8 },
    "STM":        { ctn: 700, targetStock: 8 },
    "SKMF":       { ctn: 1000, targetStock: 8 },
    "SK":         { ctn: 320, targetStock: 8 },
    "SNN ORG":    { ctn: 1000, targetStock: 8 },
    "SNN Mind":   { ctn: 1000, targetStock: 8 },
    "SNN Menthol":{ ctn: 700, targetStock: 8, alias: "SNNM" },
    "SPW":        { ctn: 500, targetStock: 8 },
    "SP":         { ctn: 500, targetStock: 8 },
    "KMK":        { ctn: 40, targetStock: 8, alias: "KMK" },
    "KOOR":       { ctn: 40, targetStock: 8, alias: "KO" },
    "SSE":        { ctn: 1000, targetStock: 8 },
    "HU":         { ctn: 10, targetStock: 8 }
  },
  SPECIAL_ROUND_UP: ["SP19 TSI", "SKM TSI", "SSJ", "SNN ORG"],
  CABANG_FULL_TIME: ["BOGOR", "TANGERANG", "SUKABUMI", "TASIKMALAYA", "KARAWANG", "BANDUNG"],
  WHP_MAPPING: {
    "WHP BANDUNG": ["BANDUNG", "PURWAKARTA", "KARAWANG", "SUKABUMI", "BOGOR", "TANGERANG", "SERANG"],
    "WHP TASIKMALAYA": ["TASIKMALAYA", "GARUT", "CIREBON"]
  },
  IGNORE_BRANCHES: ["WHP BANDUNG", "WHP TASIKMALAYA", "TOTAL", "GRAND TOTAL", "TOTAL KESELURUHAN", "BANYUMAS"],
  LEAD_TIME: {
    "BANDUNG": 1, "PURWAKARTA": 2, "KARAWANG": 2, "SUKABUMI": 2,
    "BOGOR": 2, "TANGERANG": 3, "SERANG": 4,
    "TASIKMALAYA": 1, "GARUT": 3, "CIREBON": 3
  },
  LIBUR_NASIONAL: [
    "2026-01-01", "2026-01-16", "2026-02-17", "2026-03-19",
    "2026-03-21", "2026-03-22", "2026-04-03", "2026-04-05",
    "2026-05-01", "2026-05-14", "2026-05-27", "2026-05-31",
    "2026-06-01", "2026-06-16", "2026-08-17", "2026-08-25", "2026-12-25"
  ]
};
