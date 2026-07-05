import { callApi } from '../../services/api.js';
import { formatNumber } from '../../utils/number.js';

export function initBerandaMonths() {
  const select = document.getElementById('beranda-month-select');
  select.innerHTML = '';
  const now = new Date();
  for (let i = -2; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    const val = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (i === 0) opt.selected = true;
    select.appendChild(opt);
  }
}

export function loadBeranda() {
  const dateObj = new Date();
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('header-today-date').innerText = dateObj.toLocaleDateString('id-ID', dateOptions);
  initBerandaMonths();
  const container = document.getElementById('beranda-kpis');
  document.getElementById('beranda-penjualan-value').textContent = 'Memuat...';
  callApi('getBerandaData').then(function(resp) {
    if (resp.status === 'success') {
      renderBeranda(resp.data);
    } else {
      document.getElementById('beranda-penjualan-value').textContent = 'Gagal';
    }
  }).catch(function(err) {
    document.getElementById('beranda-penjualan-value').textContent = 'Error';
  });
}

export function renderBeranda(data) {
  const k = data.kpis;
  const bulanNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  document.getElementById('beranda-penjualan-value').textContent = formatNumber(k.monthly);
  const growth = k.growth;
  const growEl = document.getElementById('beranda-penjualan-growth');
  if (growth >= 0) {
    growEl.innerHTML = '<span class="text-emerald-600 font-bold">+' + formatNumber(growth) + '</span> <span class="text-slate-400">dari bulan lalu (' + formatNumber(k.lastMonth) + ')</span>';
  } else {
    growEl.innerHTML = '<span class="text-red-600 font-bold">' + formatNumber(growth) + '</span> <span class="text-slate-400">dari bulan lalu (' + formatNumber(k.lastMonth) + ')</span>';
  }

  const distTotal = (k.distBDG || 0) + (k.distTSM || 0);
  document.getElementById('beranda-distribusi-value').textContent = formatNumber(distTotal);
  document.getElementById('beranda-distribusi-detail').innerHTML = 'BDG: ' + formatNumber(k.distBDG) + ' | TSM: ' + formatNumber(k.distTSM);

  const recTotal = (k.recBDG || 0) + (k.recTSM || 0);
  document.getElementById('beranda-penerimaan-value').textContent = formatNumber(recTotal);
  document.getElementById('beranda-penerimaan-detail').innerHTML = 'BDG: ' + formatNumber(k.recBDG) + ' | TSM: ' + formatNumber(k.recTSM);

  document.getElementById('beranda-today-value').textContent = formatNumber(k.today);
  document.getElementById('beranda-today-label').textContent = 'Penjualan pada hari terakhir';

  // Comparison table
  let html = '<table class="w-full text-left border-collapse"><thead class="bg-slate-50"><tr class="text-[10px] uppercase tracking-wider text-slate-500">';
  html += '<th class="px-3 py-2 font-bold border border-slate-200">Gudang</th>';
  html += '<th class="px-3 py-2 font-bold border border-slate-200 text-right">Distribusi</th>';
  html += '<th class="px-3 py-2 font-bold border border-slate-200 text-right">Penerimaan</th>';
  html += '<th class="px-3 py-2 font-bold border border-slate-200 text-right">Selisih</th>';
  html += '</tr></thead><tbody>';
  ['BANDUNG', 'TASIKMALAYA'].forEach(function(g) {
    const dist = g === 'BANDUNG' ? k.distBDG : k.distTSM;
    const rec = g === 'BANDUNG' ? k.recBDG : k.recTSM;
    const selisih = rec - dist;
    const cls = selisih >= 0 ? 'text-emerald-600' : 'text-red-600';
    html += '<tr class="hover:bg-slate-50">';
    html += '<td class="px-3 py-2 border border-slate-200 font-semibold">Gudang ' + g + '</td>';
    html += '<td class="px-3 py-2 border border-slate-200 text-right">' + formatNumber(dist) + '</td>';
    html += '<td class="px-3 py-2 border border-slate-200 text-right">' + formatNumber(rec) + '</td>';
    html += '<td class="px-3 py-2 border border-slate-200 text-right font-bold ' + cls + '">' + formatNumber(selisih) + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('beranda-comparison-content').innerHTML = html;
}
