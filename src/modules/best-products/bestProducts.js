import { callApi } from '../../services/api.js';
import { initMonthDropdown } from '../../ui/dropdown.js';
import { capturePivot } from '../../utils/exportImage.js';

export function loadBestProductsData() {
  const loader = document.getElementById('best-products-loader');
  const content = document.getElementById('best-products-content');
  const monthSelect = document.getElementById('best-products-month');

  if (loader && content) {
    loader.classList.remove('hidden');
    loader.classList.add('flex');
    content.innerHTML = '';
  }

  const selectedMonth = monthSelect ? monthSelect.value : '';
  callApi('getBestProductsData', selectedMonth).then(function(resp) {
    if (loader) {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    }
    if (resp.status === "success") {
      const data = resp.data;
      let html = '<div id="best-products-report-area" class="p-6"><h3 class="text-lg font-bold text-slate-800 mb-4">Ranking Produk Terlaris</h3>';
      html += '<div class="overflow-x-auto"><table class="w-full text-xs text-left"><thead class="bg-amber-50 text-amber-700 uppercase text-[10px] font-bold"><tr><th class="px-4 py-3 border-b">Peringkat</th><th class="px-4 py-3 border-b">Nama Produk</th><th class="px-4 py-3 border-b text-right">Total Terjual</th></tr></thead><tbody class="divide-y divide-slate-100">';
      let rank = 1;
      data.forEach(item => {
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        html += `<tr class="hover:bg-amber-50/50 transition-colors ${rank <= 3 ? 'bg-amber-50/30' : ''}"><td class="px-4 py-3 font-black text-lg text-center">${medal}</td><td class="px-4 py-3 font-bold text-slate-700">${item.product}</td><td class="px-4 py-3 text-right font-black text-amber-700">${item.total.toLocaleString('id-ID')}</td></tr>`;
        rank++;
      });
      html += '</tbody></table></div></div>';
      if (content) content.innerHTML = html;
    } else {
      if (content) content.innerHTML = `<div class="p-10 text-center text-red-500 font-bold">${resp.message}</div>`;
    }
  }).catch(function(err) {
    if (loader) {
      loader.classList.add('hidden');
      loader.classList.remove('flex');
    }
    console.error("Gagal memuat best products:", err);
    alert("Gagal mengambil data: " + err.message);
  });
}

export function initBestProductsMonths() {
  initMonthDropdown('best-products-month', loadBestProductsData);
}

export function captureBestProducts() {
  capturePivot('best-products-content', 'Best-Produk.png', '#btn-screenshot-best-products');
}
