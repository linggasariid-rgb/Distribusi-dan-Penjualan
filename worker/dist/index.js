var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/supabase.js
var Supabase = class {
  static {
    __name(this, "Supabase");
  }
  constructor(url, anonKey) {
    this.url = url.replace(/\/$/, "");
    this.headers = {
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`,
      "Content-Type": "application/json"
    };
  }
  async query(table, { select = "*", eq, inList, gte, lte, order, limit, range } = {}) {
    let path = `/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    if (eq) {
      for (const [col, val] of Object.entries(eq)) {
        path += `&${col}=eq.${encodeURIComponent(val)}`;
      }
    }
    if (inList) {
      for (const [col, vals] of Object.entries(inList)) {
        path += `&${col}=in.(${vals.map((v) => encodeURIComponent(v)).join(",")})`;
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
    if (limit) path += `&limit=${limit}`;
    if (range) path += `&offset=${range[0]}&limit=${range[1] - range[0] + 1}`;
    const res = await fetch(`${this.url}${path}`, { headers: this.headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }
};

// src/config.js
var CONFIG = {
  PRODUCT_INFO: {
    "SPS TSI": { ctn: 1e3, targetStock: 8 },
    "SKM TSI": { ctn: 1e3, targetStock: 8 },
    "SM": { ctn: 1e3, targetStock: 8 },
    "SP19 TSI": { ctn: 500, targetStock: 8 },
    "SPF": { ctn: 1e3, targetStock: 8 },
    "SMM": { ctn: 1e3, targetStock: 8 },
    "ST": { ctn: 700, targetStock: 8 },
    "SSJ": { ctn: 1e3, targetStock: 8 },
    "STM": { ctn: 700, targetStock: 8 },
    "SKMF": { ctn: 1e3, targetStock: 8 },
    "SK": { ctn: 320, targetStock: 8 },
    "SNN ORG": { ctn: 1e3, targetStock: 8 },
    "SNN Mind": { ctn: 1e3, targetStock: 8 },
    "SNN Menthol": { ctn: 700, targetStock: 8 },
    "SPW": { ctn: 500, targetStock: 8 },
    "SP": { ctn: 500, targetStock: 8 },
    "KMK": { ctn: 40, targetStock: 8 },
    "KOOR": { ctn: 40, targetStock: 8 },
    "SSE": { ctn: 1e3, targetStock: 8 },
    "HU": { ctn: 10, targetStock: 8 }
  },
  SPECIAL_ROUND_UP: ["SP19 TSI", "SKM TSI", "SSJ", "SNN ORG"],
  CABANG_FULL_TIME: ["BOGOR", "TANGERANG", "SUKABUMI", "TASIKMALAYA", "KARAWANG", "BANDUNG"],
  WHP_MAPPING: {
    "WHP BANDUNG": ["BANDUNG", "PURWAKARTA", "KARAWANG", "SUKABUMI", "BOGOR", "TANGERANG", "SERANG"],
    "WHP TASIKMALAYA": ["TASIKMALAYA", "GARUT", "CIREBON"]
  },
  IGNORE_BRANCHES: ["WHP BANDUNG", "WHP TASIKMALAYA", "TOTAL", "GRAND TOTAL", "TOTAL KESELURUHAN", "BANYUMAS"],
  LEAD_TIME: {
    "BANDUNG": 1,
    "PURWAKARTA": 2,
    "KARAWANG": 2,
    "SUKABUMI": 2,
    "BOGOR": 2,
    "TANGERANG": 3,
    "SERANG": 4,
    "TASIKMALAYA": 1,
    "GARUT": 3,
    "CIREBON": 3
  },
  BIZ_PRODUCT_MAP: {
    "Sin Platinum Special": "SPS TSI",
    "Sin Kujang Mas": "SKM TSI",
    "Sinergi Mind": "SM",
    "Sin Provost 19": "SP19 TSI",
    "Sin Platinum Filter": "SPF",
    "Sinergi Mind Menthol": "SMM",
    "Sin Trust": "ST",
    "Sin Sapu Jagat": "SSJ",
    "Sin Trust Menthol": "STM",
    "Sin Kujang Mas Filter": "SKMF",
    "Sin Krakatau": "SK",
    "Sin New Normal Org": "SNN ORG",
    "Sin New Normal Mind": "SNN Mind",
    "Sin New Normal Menthol": "SNN Menthol",
    "Kartu Hu versi Baru": "HU",
    "Kopi Mana Kopi": "KMK",
    "Kopi Original": "KOOR",
    "SIN Precision White": "SPW",
    "SIN Precision": "SP",
    "SIN Encode": "SSE"
  }
};
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
__name(toDateStr, "toDateStr");
function filterBranchesByWHP(branches, whp) {
  if (!whp || whp === "ALL") return branches;
  const allowed = CONFIG.WHP_MAPPING[whp] || [];
  return branches.filter((b) => allowed.includes(b));
}
__name(filterBranchesByWHP, "filterBranchesByWHP");

// src/routes/beranda.js
async function handle(db, whp) {
  const now = /* @__PURE__ */ new Date();
  const todayStr = toDateStr(now);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const currentMonth = `${year}-${month}`;
  let lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  let lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthEndStr = toDateStr(lastMonthEnd);
  const firstOfMonth = `${year}-${month}-01`;
  const whoRows = await db.query("penjualan_who", {
    select: "bulan,cabang,tipe_customer,tanggal,jumlah,products",
    gte: { tanggal: firstOfMonth },
    lte: { tanggal: todayStr }
  });
  const whoLastMonth = await db.query("penjualan_who", {
    select: "bulan,cabang,tipe_customer,tanggal,jumlah",
    gte: { tanggal: `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01` },
    lte: { tanggal: lastMonthEndStr }
  });
  let monthly = 0, today = 0, lastMonthTotal = 0;
  let dailyMap = {};
  const cabangSet = /* @__PURE__ */ new Set();
  for (const r of whoRows) {
    const c = r.cabang;
    if (CONFIG.IGNORE_BRANCHES.includes(c)) continue;
    cabangSet.add(c);
    monthly += r.jumlah || 0;
    if (r.tanggal === todayStr) today += r.jumlah || 0;
    dailyMap[r.tanggal] = (dailyMap[r.tanggal] || 0) + (r.jumlah || 0);
  }
  for (const r of whoLastMonth) {
    const c = r.cabang;
    if (CONFIG.IGNORE_BRANCHES.includes(c)) continue;
    lastMonthTotal += r.jumlah || 0;
  }
  let growth = 0;
  if (lastMonthTotal > 0) {
    growth = (monthly - lastMonthTotal) / lastMonthTotal * 100;
  }
  const allCabang = [...cabangSet].sort();
  const filteredCabang = filterBranchesByWHP(allCabang, whp);
  const ranking = [];
  const branchTotals = {};
  for (const r of whoRows) {
    const c = r.cabang;
    if (!filteredCabang.includes(c)) continue;
    branchTotals[c] = (branchTotals[c] || 0) + (r.jumlah || 0);
  }
  for (const [branch, total] of Object.entries(branchTotals)) {
    ranking.push({ branch, total });
  }
  ranking.sort((a, b) => b.total - a.total);
  const dailyLabels = [];
  const dailyValues = [];
  const dayCount = 15;
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toDateStr(d);
    dailyLabels.push(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);
    dailyValues.push(dailyMap[key] || 0);
  }
  const distRows = await db.query("distribusi", {
    select: "gudang,jumlah",
    gte: { tanggal: firstOfMonth },
    lte: { tanggal: todayStr }
  });
  let distBDG = 0, distTSM = 0;
  for (const r of distRows) {
    const g = (r.gudang || "").toUpperCase();
    if (g.includes("BANDUNG")) distBDG += r.jumlah || 0;
    if (g.includes("TASIK")) distTSM += r.jumlah || 0;
  }
  const penerimaanRows = await db.query("penerimaan", {
    select: "gudang,jumlah",
    gte: { tanggal: firstOfMonth },
    lte: { tanggal: todayStr }
  });
  let recBDG = 0, recTSM = 0;
  for (const r of penerimaanRows) {
    const g = (r.gudang || "").toUpperCase();
    if (g.includes("BANDUNG")) recBDG += r.jumlah || 0;
    if (g.includes("TASIK")) recTSM += r.jumlah || 0;
  }
  return {
    status: "success",
    data: {
      kpis: {
        lastMonth: lastMonthTotal,
        monthly,
        growth: Math.round(growth * 100) / 100,
        today,
        distBDG,
        distTSM,
        recBDG,
        recTSM
      },
      ranking,
      dailyTrend: { labels: dailyLabels, values: dailyValues }
    }
  };
}
__name(handle, "handle");

// src/routes/sales-hub.js
async function handle2(db, whp, currDateStr, prevDateStr, backdateStr) {
  const now = /* @__PURE__ */ new Date();
  const todayStr = toDateStr(now);
  const currDate = currDateStr ? new Date(currDateStr) : now;
  const currYear = currDate.getFullYear();
  const currMon = currDate.getMonth();
  const prevDate = prevDateStr ? new Date(prevDateStr) : new Date(currYear, currMon - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMon = prevDate.getMonth();
  const backDate = backdateStr ? new Date(backdateStr) : new Date(currYear, currMon - 2, 1);
  const currStart = toDateStr(new Date(currYear, currMon, 1));
  const currEnd = toDateStr(currDate);
  const prevStart = toDateStr(new Date(prevYear, prevMon, 1));
  const prevEnd = toDateStr(new Date(prevYear, prevMon + 1, 0));
  const currRows = await db.query("penjualan_who", {
    select: "cabang,tipe_customer,tanggal,jumlah",
    gte: { tanggal: currStart },
    lte: { tanggal: currEnd }
  });
  const prevRows = await db.query("penjualan_who", {
    select: "cabang,tipe_customer,tanggal,jumlah",
    gte: { tanggal: prevStart },
    lte: { tanggal: prevEnd }
  });
  const isSameDayRange = currDate.getDate() < 28 && prevDate.getDate() < 28;
  const allCabang = [...new Set([
    ...currRows.map((r) => r.cabang),
    ...prevRows.map((r) => r.cabang)
  ].filter((c) => !CONFIG.IGNORE_BRANCHES.includes(c)))].sort();
  const cabangList = filterBranchesByWHP(allCabang, whp);
  function aggregate(rows, limitDay) {
    const byCabang = {};
    for (const c of cabangList) byCabang[c] = { warehouse: 0, stokis: 0, masterStokis: 0, karyawan: 0, tsiApps: 0, msi: 0, total: 0 };
    for (const r of rows) {
      if (!cabangList.includes(r.cabang)) continue;
      const tipe = (r.tipe_customer || "").toUpperCase();
      const val = r.jumlah || 0;
      const entry = byCabang[r.cabang];
      entry.total += val;
      if (tipe === "MST") entry.masterStokis += val;
      else if (tipe === "STK") entry.stokis += val;
      else if (tipe === "KARYAWAN") entry.karyawan += val;
      else if (tipe === "TSIAPPS") entry.tsiApps += val;
      else if (tipe === "MSI") entry.msi += val;
      else entry.warehouse += val;
    }
    return cabangList.map((c) => ({ ...byCabang[c], cabang: c }));
  }
  __name(aggregate, "aggregate");
  const currentMonthData = aggregate(currRows, isSameDayRange ? currDate.getDate() : null);
  const previousMonthData = aggregate(prevRows, null);
  const currTotal = currentMonthData.reduce((s, r) => s + r.total, 0);
  const prevTotal = previousMonthData.reduce((s, r) => s + r.total, 0);
  const delta = currTotal - prevTotal;
  const growthPct = prevTotal > 0 ? Math.round(delta / prevTotal * 1e4) / 100 : 0;
  const todayTotal = currRows.filter((r) => r.tanggal === todayStr).reduce((s, r) => s + (r.jumlah || 0), 0);
  const currDays = currDate.getDate();
  const dateSnapshots = [];
  for (let d = 1; d <= currDays; d++) {
    const dateKey = `${currYear}-${String(currMon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayRows = currRows.filter((r) => r.tanggal === dateKey);
    dateSnapshots.push({
      date: dateKey,
      data: aggregate(dayRows, null)
    });
  }
  const dailyComparison = [];
  const maxDay = Math.min(currDays, new Date(prevYear, prevMon + 1, 0).getDate());
  for (let d = 1; d <= maxDay; d++) {
    const dayStrCurr = `${currYear}-${String(currMon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayStrPrev = `${prevYear}-${String(prevMon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const currVal = currRows.filter((r) => r.tanggal === dayStrCurr).reduce((s, r) => s + (r.jumlah || 0), 0);
    const prevVal = prevRows.filter((r) => r.tanggal === dayStrPrev).reduce((s, r) => s + (r.jumlah || 0), 0);
    dailyComparison.push({
      date: `${String(d).padStart(2, "0")}/${String(currMon + 1).padStart(2, "0")}`,
      current: currVal,
      previous: prevVal,
      delta: currVal - prevVal
    });
  }
  return {
    status: "success",
    data: {
      currentMonth: { label: `${currMon + 1}/${currYear}`, data: currentMonthData },
      previousMonth: { label: `${prevMon + 1}/${prevYear}`, data: previousMonthData },
      kpis: { delta, growthPct, currentTotal: currTotal, previousTotal: prevTotal, currentDays: currDays, todayTotal },
      dateSnapshots,
      branches: cabangList,
      dailyComparison
    }
  };
}
__name(handle2, "handle");

// src/routes/sales-report.js
async function handle3(db, dayFilter, filterMonth, startMonth, whp) {
  let gte, lte;
  if (filterMonth) {
    const parts = filterMonth.split("-");
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1;
    gte = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    lte = toDateStr(new Date(y, m + 1, 0));
  } else if (startMonth) {
    gte = `${startMonth}-01`;
    lte = toDateStr(/* @__PURE__ */ new Date());
  } else {
    const now = /* @__PURE__ */ new Date();
    gte = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    lte = toDateStr(now);
  }
  const rows = await db.query("penjualan_who", {
    select: "cabang,tanggal,jumlah",
    gte: { tanggal: gte },
    lte: { tanggal: lte }
  });
  const cabangSet = /* @__PURE__ */ new Set();
  for (const r of rows) {
    if (!CONFIG.IGNORE_BRANCHES.includes(r.cabang)) cabangSet.add(r.cabang);
  }
  const cabangList = filterBranchesByWHP([...cabangSet].sort(), whp);
  const pivot = {};
  for (const r of rows) {
    if (!cabangList.includes(r.cabang)) continue;
    const d = r.tanggal;
    if (!pivot[d]) pivot[d] = {};
    pivot[d][r.cabang] = (pivot[d][r.cabang] || 0) + (r.jumlah || 0);
  }
  const result = [];
  const sortedDates = Object.keys(pivot).sort();
  for (const date of sortedDates) {
    const row = { date };
    let grandTotal = 0;
    for (const c of cabangList) {
      const val = pivot[date][c] || 0;
      row[c] = val;
      grandTotal += val;
    }
    row.grandTotal = grandTotal;
    result.push(row);
  }
  return {
    status: "success",
    branches: cabangList,
    rows: result
  };
}
__name(handle3, "handle");

// src/routes/best-products.js
async function months(db) {
  const rows = await db.query("penjualan_who", {
    select: "tanggal",
    order: "tanggal.asc"
  });
  const monthSet = /* @__PURE__ */ new Set();
  for (const r of rows) {
    if (r.tanggal) {
      monthSet.add(r.tanggal.slice(0, 7));
    }
  }
  return { status: "success", data: [...monthSet].sort() };
}
__name(months, "months");
async function data(db, filterMonth) {
  let targetMonth;
  if (filterMonth) {
    targetMonth = filterMonth;
  } else {
    const now = /* @__PURE__ */ new Date();
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const rows = await db.query("penjualan_who", {
    select: "tanggal,jumlah,products",
    gte: { tanggal: `${targetMonth}-01` },
    lte: { tanggal: `${targetMonth}-31` }
  });
  const totals = {};
  const productKeys = Object.keys(CONFIG.PRODUCT_INFO).filter((p) => p !== "HU");
  for (const p of productKeys) totals[p] = 0;
  for (const r of rows) {
    if (!r.tanggal || !r.tanggal.startsWith(targetMonth)) continue;
    const prods = r.products || {};
    for (const p of productKeys) {
      totals[p] += prods[p] || 0;
    }
  }
  const ranking = Object.entries(totals).map(([product, total]) => ({ product, total })).sort((a, b) => b.total - a.total);
  return { status: "success", data: ranking };
}
__name(data, "data");

// src/routes/control-point.js
async function getLatestBizPeriod(db) {
  const rows = await db.query("biz_stock", {
    select: "periode",
    order: "periode.desc",
    limit: 1
  });
  return rows.length > 0 ? rows[0].periode : null;
}
__name(getLatestBizPeriod, "getLatestBizPeriod");
async function handle4(db) {
  try {
    let getVal = function(products, key) {
      if (!products) return 0;
      const v = products[key];
      if (v === void 0 || v === null || v === "" || v === "-") return 0;
      return parseInt(v) || 0;
    }, sumStock = function(...cabangs) {
      const sums = {};
      for (const pc of productCols) {
        sums[pc.bizName] = 0;
        for (const cab of cabangs) {
          const sp = stockByBranch[cab];
          if (sp) sums[pc.bizName] += getVal(sp, pc.internalName);
        }
      }
      return sums;
    };
    __name(getVal, "getVal");
    __name(sumStock, "sumStock");
    const period = await getLatestBizPeriod(db);
    const stockRows = await db.query("stock", {
      select: "cabang,products"
    });
    const bizRows = await db.query("biz_stock", {
      select: "cabang,products,periode",
      eq: { periode: period }
    });
    const stockByBranch = {};
    for (const r of stockRows) {
      stockByBranch[r.cabang] = r.products || {};
    }
    const productKeys = Object.keys(CONFIG.BIZ_PRODUCT_MAP);
    const productCols = [];
    for (const bizName of productKeys) {
      const internalName = CONFIG.BIZ_PRODUCT_MAP[bizName];
      productCols.push({ bizName, internalName });
    }
    const report = [];
    for (const biz of bizRows) {
      const cabang = biz.cabang;
      const stockProds = stockByBranch[cabang];
      if (!stockProds) continue;
      let totalSelisih = 0;
      const details = [];
      for (const pc of productCols) {
        const bizVal = getVal(biz.products, pc.bizName);
        const stockVal = getVal(stockProds, pc.internalName);
        const selisih = bizVal - stockVal;
        if (Math.abs(selisih) > 0.1) {
          totalSelisih += Math.abs(selisih);
          details.push({
            produk: pc.bizName,
            biz: bizVal.toLocaleString("id-ID"),
            excel: stockVal.toLocaleString("id-ID"),
            selisih: selisih.toLocaleString("id-ID")
          });
        }
      }
      report.push({
        cabang,
        status: details.length === 0 ? "MATCH" : "MISMATCH",
        totalSelisih,
        details
      });
    }
    return report;
  } catch (err) {
    return { error: err.message };
  }
}
__name(handle4, "handle");

// src/routes/distribution.js
async function handle5(db, whp) {
  const now = /* @__PURE__ */ new Date();
  const todayStr = toDateStr(now);
  const startDate = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13));
  const salesRows = await db.query("penjualan_who", {
    select: "cabang,tanggal,jumlah,products",
    gte: { tanggal: startDate },
    lte: { tanggal: todayStr }
  });
  const stockRows = await db.query("stock", {
    select: "cabang,products"
  });
  const stockByBranch = {};
  for (const r of stockRows) {
    stockByBranch[r.cabang] = r.products || {};
  }
  const branches = await db.query("branches", {
    select: "name,whp,is_full_time,lead_time,is_active"
  });
  const branchMap = {};
  for (const b of branches) {
    branchMap[b.name] = b;
  }
  const productKeys = Object.keys(CONFIG.PRODUCT_INFO);
  const productInfo = CONFIG.PRODUCT_INFO;
  const salesByBranchProduct = {};
  for (const r of salesRows) {
    const cabang = r.cabang;
    if (CONFIG.IGNORE_BRANCHES.includes(cabang)) continue;
    if (!salesByBranchProduct[cabang]) salesByBranchProduct[cabang] = {};
    const prods = r.products || {};
    for (const p of productKeys) {
      if (!salesByBranchProduct[cabang][p]) salesByBranchProduct[cabang][p] = 0;
      salesByBranchProduct[cabang][p] += prods[p] || 0;
    }
  }
  const result = {};
  const specialRoundUp = CONFIG.SPECIAL_ROUND_UP || [];
  for (const [cabang, prods] of Object.entries(salesByBranchProduct)) {
    const branchInfo = branchMap[cabang];
    if (!branchInfo) continue;
    if (whp && whp !== "ALL" && branchInfo.whp !== whp.replace("WHP ", "")) continue;
    const produk = {};
    const pembagi = 14;
    for (const p of productKeys) {
      const currentStock = stockByBranch[cabang]?.[p] || 0;
      const salesTotal = prods[p] || 0;
      produk[p] = { salesTotal, currentStock };
    }
    result[cabang] = {
      nama: cabang,
      pembagi,
      produk
    };
  }
  const whpStockData = {};
  for (const [cabang, prods] of Object.entries(stockByBranch)) {
    if (cabang.startsWith("GUDANG ") || cabang.startsWith("WHP ")) {
      whpStockData[cabang] = prods;
    }
  }
  const whpMapping = {};
  for (const [whpName, cabangs] of Object.entries(CONFIG.WHP_MAPPING)) {
    whpMapping[whpName] = cabangs;
  }
  return {
    status: "success",
    data: {
      result,
      productList: productKeys,
      productInfo,
      whpMapping,
      specialRoundUp,
      whpStockData,
      leadTime: CONFIG.LEAD_TIME
    }
  };
}
__name(handle5, "handle");

// src/index.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function json(data2, status = 200) {
  return new Response(JSON.stringify(data2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}
__name(json, "json");
function error(msg, status = 400) {
  return json({ status: "error", message: msg }, status);
}
__name(error, "error");
var index_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const db = new Supabase(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    try {
      if (path === "/api/beranda" || path === "/api/beranda/") {
        const whp = url.searchParams.get("whp") || "";
        return json(await handle(db, whp));
      }
      if (path === "/api/sales-hub" || path === "/api/sales-hub/") {
        const whp = url.searchParams.get("whp") || "";
        const currDate = url.searchParams.get("currDate") || "";
        const prevDate = url.searchParams.get("prevDate") || "";
        const backDate = url.searchParams.get("backDate") || "";
        return json(await handle2(db, whp, currDate, prevDate, backDate));
      }
      if (path === "/api/sales-report" || path === "/api/sales-report/") {
        const dayFilter = parseInt(url.searchParams.get("dayFilter") || "-1");
        const filterMonth = url.searchParams.get("filterMonth") || "";
        const startMonth = url.searchParams.get("startMonth") || "";
        const whp = url.searchParams.get("whp") || "";
        return json(await handle3(db, dayFilter, filterMonth, startMonth, whp));
      }
      if (path === "/api/best-products/months") {
        return json(await months(db));
      }
      if (path === "/api/best-products/data") {
        const month = url.searchParams.get("month") || "";
        return json(await data(db, month));
      }
      if (path === "/api/control-point") {
        return json(await handle4(db));
      }
      if (path === "/api/distribution") {
        const whp = url.searchParams.get("whp") || "";
        return json(await handle5(db, whp));
      }
      return json({ status: "error", message: "Not found" }, 404);
    } catch (err) {
      console.error("Worker error:", err);
      return error(err.message, 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
