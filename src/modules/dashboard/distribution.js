import { callApi } from '../../services/api.js';
import { getUserWHP } from '../../state/authState.js';
import { state } from '../../state/appState.js';
import { showToast } from '../../ui/toast.js';
import { getWHP } from './whpMapping.js';
import { renderStockSummaryTable } from './summary.js';

let branchDays = {};
let branchBuffers = {};
let urgentBranchesData = {};
let whpCriticalData = { "WHP BANDUNG": [], "WHP TASIKMALAYA": [] };
let globalAllocations = {};

export function loadData() {
  // Update Tanggal Hari Ini di Header
  const dateObj = new Date();
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('header-today-date').innerText = dateObj.toLocaleDateString('id-ID', dateOptions);

  const loader = document.getElementById('loader');
  const content = document.getElementById('content');
  const stockContent = document.getElementById('stock-summary-content');
  const summary = document.getElementById('summarySection');

  loader.classList.remove('hidden');
  loader.classList.add('flex');
  content.innerHTML = '';
  stockContent.innerHTML = '';
  summary.classList.add('hidden');
  summary.classList.remove('grid');

  callApi('getDistributionData', getUserWHP()).then(function(resp) {
    loader.classList.add('hidden');
    loader.classList.remove('flex');
    if (resp.status === "error") {
      content.innerHTML = `<div class="text-red-500 text-center font-bold p-10 bg-red-50 rounded-xl border border-red-200">${resp.message}</div>`;
    } else {
      state.gData = resp.data;
      initFilter();
      renderCards();
      renderStockSummaryTable();
    }
  }).catch(function(err) {
    loader.classList.add('hidden');
    loader.classList.remove('flex');
    content.innerHTML = `<div class="text-red-500 text-center font-bold p-10 bg-red-50 rounded-xl border border-red-200">Gagal Memuat Data: ${err.message}</div>`;
  });
}

export function initFilter() {
  const userWHP = getUserWHP();
  const select = document.getElementById('branchFilter');
  let keys = Object.keys(state.gData.result).sort();
  select.innerHTML = '<option value="ALL">-- Tampilkan Semua Cabang --</option>';

  keys.forEach(k => {
    select.add(new Option(state.gData.result[k].nama, k));

    if (!branchDays[k]) branchDays[k] = 8;
    if (branchBuffers[k] === undefined) branchBuffers[k] = 4;
  });

  const whpSelect = document.getElementById('whpFilter');
  whpSelect.innerHTML = '<option value="ALL">-- Tampilkan Semua WHO --</option>';
  const whpKeys = Object.keys(state.gData.whpMapping).sort();
  whpKeys.forEach(k => {
    let opt = document.createElement('option');
    opt.value = k;
    opt.text = k;
    whpSelect.add(opt);
  });

  if (userWHP) {
    whpSelect.value = userWHP;
    whpSelect.disabled = true;
  }

  const summary = document.getElementById('summarySection');
  const distView = document.getElementById('distribution-view');
  if (distView.style.display !== 'none') {
    summary.classList.remove('hidden');
    summary.classList.add('grid');
  }
}

export function calculateLogic(cabangKey, p) {
  let cb = state.gData.result[cabangKey];
  let pInfo = state.gData.productInfo[p] || {ctn:10, targetStock:8};
  let targetDays = branchDays[cabangKey] || 8;
  let bufferDays = branchBuffers[cabangKey] !== undefined ? branchBuffers[cabangKey] : 4;
  let leadTime = state.gData.leadTime && state.gData.leadTime[cabangKey] !== undefined ? state.gData.leadTime[cabangKey] : 1;
  let totalDays = targetDays + bufferDays;
  let hasSalesData = cb.produk[p].salesTotal > 0;
  let dsr = hasSalesData ? Math.ceil(cb.produk[p].salesTotal / cb.pembagi) : 0;
  let stok = cb.produk[p].currentStock;

  let sisaHari = hasSalesData ? (dsr > 0 ? (stok / dsr) : 99) : null;
  let qtyReguler = hasSalesData ? Math.max(0, (dsr * totalDays) - stok) : 0;

  let qtyMendesak = 0;
  if (hasSalesData && sisaHari !== null && sisaHari <= leadTime + 0.5) {
    qtyMendesak = Math.max(0, (dsr * (leadTime + 1)) - stok);
  }

  const pembulatan = (q) => {
    if (q <= 0) return 0;
    let alwaysUp = state.gData.specialRoundUp || ["SP19 TSI", "SKM TSI", "SSJ", "SNN ORG"];
    let ctn = pInfo.ctn;
    if (alwaysUp.includes(p.toUpperCase())) return Math.ceil(q / ctn) * ctn;
    let rounded = Math.round(q / ctn) * ctn;
    return rounded > 0 ? rounded : ctn;
  };

  return {
    dsr: dsr,
    stok: stok,
    sisaHari: sisaHari,
    kirimReguler: hasSalesData ? pembulatan(qtyReguler) : 0,
    kirimMendesak: hasSalesData ? pembulatan(qtyMendesak) : 0,
    isCritical: hasSalesData && sisaHari !== null && sisaHari <= 1.0,
    isWarning: hasSalesData && sisaHari !== null && sisaHari > 1.0 && sisaHari <= 2.0,
    noSalesData: !hasSalesData
  };
}

export function renderCards() {
  // --- LOGIKA ALOKASI PEMBAGIAN STOK WHP ---
  let allocations = {};
  for (let key in state.gData.result) { allocations[key] = {}; }

  // Reset data stok kritis WHP
  whpCriticalData = { "WHP BANDUNG": [], "WHP TASIKMALAYA": [] };

  // Counter untuk Produk Stok Kritis di WHP
  let bdgCriticalCount = 0;
  let tsmCriticalCount = 0;

  state.gData.productList.forEach(p => {
    let whpRequests = {};
    for (let key in state.gData.result) {
      let whp = getWHP(key);
      if (!whpRequests[whp]) whpRequests[whp] = [];
      let res = calculateLogic(key, p);
      let req = res.kirimMendesak > 0 ? res.kirimMendesak : res.kirimReguler;
      whpRequests[whp].push({ branch: key, req: req, sisaHari: res.sisaHari, allocated: 0 });
    }

    for (let whp in whpRequests) {
      let branchesReq = whpRequests[whp];
      let totalReq = branchesReq.reduce((sum, b) => sum + b.req, 0);
      let whpExists = state.gData.whpStockData && state.gData.whpStockData[whp];
      let available = whpExists ? (state.gData.whpStockData[whp][p] || 0) : Infinity;

      // Cek stok kritis: Stok Kosong di WHP ATAU total kebutuhan cabang > stok yang tersedia
      if ((available === 0 || (totalReq > available && totalReq > 0)) && available !== Infinity) {
        if (whp === "WHP BANDUNG") {
          bdgCriticalCount++;
          whpCriticalData["WHP BANDUNG"].push({ product: p, available: available, totalReq: totalReq });
        }
        if (whp === "WHP TASIKMALAYA") {
          tsmCriticalCount++;
          whpCriticalData["WHP TASIKMALAYA"].push({ product: p, available: available, totalReq: totalReq });
        }
      }

      if (totalReq <= available) {
        branchesReq.forEach(b => allocations[b.branch][p] = b.req);
      } else {
        // Stok tidak cukup! Prioritaskan yang Sisa Harinya paling kecil (paling Kritis)
        branchesReq.sort((a, b) => a.sisaHari - b.sisaHari);
        let ctn = state.gData.productInfo[p].ctn || 10;

        let keepAllocating = true;
        while (keepAllocating && available >= ctn) {
          keepAllocating = false;
          for (let i = 0; i < branchesReq.length; i++) {
            if (available < ctn) break;
            let bReq = branchesReq[i];
            if (bReq.allocated + ctn <= bReq.req) {
              bReq.allocated += ctn; available -= ctn; keepAllocating = true;
            }
          }
        }
        // Alokasikan sisa stok (< 1 CTN) ke cabang paling kritis yang masih butuh
        if (available > 0) {
          for (let i = 0; i < branchesReq.length; i++) {
            let bReq = branchesReq[i];
            if (bReq.allocated < bReq.req) {
              let sisa = Math.min(available, bReq.req - bReq.allocated);
              bReq.allocated += sisa;
              available -= sisa;
              break;
            }
          }
        }
        branchesReq.forEach(b => allocations[b.branch][p] = b.allocated);
      }
    }
  });
  globalAllocations = allocations;
  // ------------------------------------------

  const filter = document.getElementById('branchFilter').value;
  let html = '';
  let grandTotal = 0;

  // Clear urgentBranchesData for a fresh render
  urgentBranchesData = {};

  for (let key in state.gData.result) {
    if (filter !== "ALL" && filter !== key) continue;

    let rows = '';
    let totalKirimCabang = 0;
    let cabangHasCritical = false;

    let criticalProductsForBranch = []; // To store critical products for this branch
    state.gData.productList.forEach(p => {
      let res = calculateLogic(key, p);
      let reqIdeal = res.kirimMendesak > 0 ? res.kirimMendesak : res.kirimReguler;
      let qtyFinal = globalAllocations[key][p];
      // Limit stok WHP terdeteksi jika alokasi lebih kecil dari kebutuhan ideal (target hari)
      let isStockLimit = qtyFinal < reqIdeal && reqIdeal > 0;

      totalKirimCabang += qtyFinal;
      if (res.isCritical) {
        cabangHasCritical = true;
        criticalProductsForBranch.push({
          product: p,
          sisaHari: res.sisaHari,
          qtyToShip: qtyFinal,
          reqIdeal: reqIdeal,
          isStockLimit: isStockLimit            });
      }

      let noData = res.noSalesData;
      let dayStyle = noData ? 'color:var(--color-text-muted);font-style:italic;font-size:0.75rem' : (res.isCritical ? 'color:var(--color-danger);font-weight:900;background:var(--color-danger-light)' : (res.isWarning ? 'color:var(--color-accent);font-weight:900;background:var(--color-accent-light)' : 'color:var(--color-text-secondary);font-weight:500;font-size:0.75rem'));
      let rowStyle = res.isCritical ? 'background:rgba(220,38,38,0.04)' : (noData ? 'opacity:0.6' : '');

      let qtyDisplay = isStockLimit ? `<span style="color:var(--color-danger);font-weight:900" title="Stok WHP Limit (Kebutuhan Ideal: ${reqIdeal.toLocaleString('id-ID')})">${qtyFinal.toLocaleString('id-ID')}</span>` : qtyFinal.toLocaleString('id-ID');
      let mendesakDisplay = noData ? '-' : (res.kirimMendesak > 0 ? qtyDisplay : '-');
      let regulerDisplay = noData ? '-' : (res.kirimMendesak > 0 ? '-' : qtyDisplay);
      let sisaHariDisplay = noData ? 'N/A' : (res.sisaHari.toFixed(1) + ' Hari');

      rows += `
        <tr style="${rowStyle}">
          <td class="px-5 py-3 whitespace-nowrap font-bold" style="color:var(--color-text)">${p}</td>
          <td class="px-5 py-3 whitespace-nowrap font-medium" style="color:var(--color-text-secondary)">${res.dsr}</td>
          <td class="px-5 py-3 whitespace-nowrap font-medium" style="color:var(--color-text-secondary)">${res.stok}</td>
          <td class="px-5 py-3 whitespace-nowrap rounded-lg text-sm" style="${dayStyle}">${sisaHariDisplay}</td>
          <td class="px-5 py-3 whitespace-nowrap font-extrabold" style="color:var(--color-text)">${regulerDisplay}</td>
          <td class="px-5 py-3 whitespace-nowrap font-extrabold" style="color:var(--color-danger)">${mendesakDisplay}</td>
        </tr>`;
    });

    if (cabangHasCritical) {
      urgentBranchesData[key] = { name: state.gData.result[key].nama, products: criticalProductsForBranch };
    }
    grandTotal += totalKirimCabang;

    html += `
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
        <!-- Branch Header -->
        <div class="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-extrabold text-blue-800 uppercase tracking-tight">${state.gData.result[key].nama}</h2>
            ${cabangHasCritical ? '<span class="bg-red-100 text-red-600 px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 animate-pulse"><i class="fas fa-exclamation-circle"></i> Kritis</span>' : ''}
          </div>
          <div class="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
            <div class="text-xs font-semibold text-slate-500 flex items-center gap-2 border-r border-slate-200 pr-4">
              <span class="text-indigo-600 font-bold">LT ${state.gData.leadTime && state.gData.leadTime[key] ? state.gData.leadTime[key] : '?'}H</span>
              <span class="text-slate-300 mx-1">|</span>
              Target
              <input type="number" value="${branchDays[key]}" data-action="update-target" data-key="${key}" class="w-14 px-1 py-1 border border-slate-300 rounded-lg text-center font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"> H
              <span class="text-slate-300 mx-1">|</span>
              Buffer
              <input type="number" value="${branchBuffers[key]}" data-action="update-buffer" data-key="${key}" class="w-14 px-1 py-1 border border-slate-300 rounded-lg text-center font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"> H
            </div>
            <div class="text-xs font-bold text-slate-700 whitespace-nowrap">
              Total: <span class="text-blue-600 text-base ml-1">${totalKirimCabang.toLocaleString('id-ID')}</span> Bks
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto table-container">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-100/50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                <th class="px-5 py-3 font-bold">Produk</th>
                <th class="px-5 py-3 font-bold">Avg /H</th>
                <th class="px-5 py-3 font-bold">Stok</th>
                <th class="px-5 py-3 font-bold">Kecukupan Produk</th>
                <th class="px-5 py-3 font-bold">Kirim (${branchDays[key]}H + ${branchBuffers[key]}H)</th>
                <th class="px-5 py-3 font-bold">Mendesak</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${rows}
            </tbody>
          </table>
        </div>

        <!-- Action Button -->
        <div class="p-4 bg-slate-50/50 border-t border-slate-100">
          <button class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 active:scale-[0.98] text-base" data-action="copy-wa" data-key="${key}">
            <i class="fab fa-whatsapp text-xl"></i> Salin Data untuk Gudang (WH)
          </button>
        </div>
      </div>`;
  }

  document.getElementById('content').innerHTML = html;
  document.getElementById('urgentCountModalTrigger').innerText = Object.keys(urgentBranchesData).length;
  document.getElementById('whpBandungMinStockCount').innerText = bdgCriticalCount;
  document.getElementById('whpTasikmalayaMinStockCount').innerText = tsmCriticalCount;
}

export function updateTarget(key, val) {
  branchDays[key] = parseInt(val) || 1;
  renderCards();
}

export function updateBuffer(key, val) {
  branchBuffers[key] = parseInt(val) || 0;
  renderCards();
}

export function copyWA(key) {
  let cb = state.gData.result[key];
  let text = `*DISTRIBUSI : ${cb.nama.toUpperCase()}*\n\n`;
  let total = 0;

  state.gData.productList.forEach(p => {
    let res = calculateLogic(key, p);
    let qtyFinal = globalAllocations[key][p];
    if (qtyFinal > 0) {
      text += `• *${p}*: ${qtyFinal.toLocaleString('id-ID')} Bks ${res.isCritical ? '(URGENT! 🚨)' : ''}\n`;
      total += qtyFinal;
    }
  });

  text += `\n*TOTAL: ${total.toLocaleString('id-ID')} Bks*`;
  text += `\n\n_Powered by ATR Crafted by SND_`;

  const el = document.createElement('textarea');
  el.value = text; document.body.appendChild(el);
  el.select(); document.execCommand('copy');
  document.body.removeChild(el);

  showToast("Teks WhatsApp berhasil disalin!");
}

export function openUrgentProductsModal() {
  const modal = document.getElementById('urgentProductsModal');
  const modalContent = document.getElementById('urgentProductsModalContent');
  const modalHeader = modal.querySelector('h2');

  // Reset Header untuk Urgensi Cabang
  modalHeader.innerHTML = `<i class="fas fa-exclamation-triangle text-red-500"></i> Produk Mendesak`;
  modalHeader.className = "text-xl font-bold text-red-700 flex items-center gap-3";

  modalContent.innerHTML = ''; // Clear previous content

  let contentHtml = '<div class="space-y-4">';
  const urgentBranchKeys = Object.keys(urgentBranchesData);

  if (urgentBranchKeys.length === 0) {
    contentHtml += '<p class="text-slate-600 text-center p-4">Tidak ada produk yang harus segera dikirim saat ini.</p>';
  } else {
    // Sort branches by name for consistent display
    urgentBranchKeys.sort((a, b) => urgentBranchesData[a].name.localeCompare(urgentBranchesData[b].name));

    urgentBranchKeys.forEach(branchKey => {
      const branchInfo = urgentBranchesData[branchKey];
      contentHtml += `
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-bold text-base text-blue-700">${branchInfo.name}</h3>
            <button data-action="view-branch" data-branch="${branchKey}" class="bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-xs font-semibold hover:bg-blue-200 transition-colors">
              <i class="fas fa-eye mr-1"></i> Lihat
            </button>
          </div>
          <ul class="list-disc list-inside text-sm text-slate-700 space-y-1">
      `;
      // Sort products by name
      branchInfo.products.sort((a, b) => a.product.localeCompare(b.product));

      branchInfo.products.forEach(product => {
        let qtyDisplay = product.qtyToShip.toLocaleString('id-ID');
        if (product.isStockLimit) {
          qtyDisplay = `<span class="text-red-600 font-bold">${qtyDisplay}</span>`;
        }
        contentHtml += `<li class="text-xs">${product.product}: ${qtyDisplay} Bks (Sisa Hari: ${product.sisaHari.toFixed(1)})</li>`;
      });
      contentHtml += `
          </ul>
        </div>
      `;
    });
  }
  contentHtml += '</div>';
  modalContent.innerHTML = contentHtml;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

export function closeUrgentProductsModal() {
  const modal = document.getElementById('urgentProductsModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

export function viewBranchFromModal(branchKey) {
  document.getElementById('branchFilter').value = branchKey;
  renderCards();
  closeUrgentProductsModal();
}

export function openWHPCriticalModal(whpName) {
  const modal = document.getElementById('urgentProductsModal');
  const modalContent = document.getElementById('urgentProductsModalContent');
  const modalHeader = modal.querySelector('h2');

  // Update Header untuk Stok Kritis WHP
  modalHeader.innerHTML = `<i class="fas fa-warehouse text-amber-500"></i> Detail Stok Kritis: ${whpName}`;
  modalHeader.className = "text-xl font-bold text-amber-700 flex items-center gap-3";

  let products = whpCriticalData[whpName] || [];
  let contentHtml = '<div class="overflow-x-auto"><table class="w-full text-xs text-left border-collapse">';
  contentHtml += `
    <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
      <tr>
        <th class="px-4 py-3 border-b">Nama Produk</th>
        <th class="px-4 py-3 border-b text-right">Stok Tersedia</th>
        <th class="px-4 py-3 border-b text-right">Total Kebutuhan</th>
        <th class="px-4 py-3 border-b text-right text-red-600">Selisih Kurang</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100">`;

  if (products.length === 0) {
    contentHtml += '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-500 font-medium">Semua kebutuhan cabang untuk gudang ini terpenuhi oleh stok WHP.</td></tr>';
  } else {
    products.forEach(p => {
      const short = p.totalReq - (p.available === Infinity ? p.totalReq : p.available);
      contentHtml += `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-4 py-3 font-bold text-slate-700">${p.product}</td>
          <td class="px-4 py-3 text-right text-blue-600 font-bold">${p.available === Infinity ? '∞' : p.available.toLocaleString('id-ID')}</td>
          <td class="px-4 py-3 text-right text-slate-600">${p.totalReq.toLocaleString('id-ID')}</td>
          <td class="px-4 py-3 text-right text-red-600 font-black">-${short.toLocaleString('id-ID')}</td>
        </tr>`;
    });
  }

  contentHtml += '</tbody></table></div>';
  modalContent.innerHTML = contentHtml;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}
