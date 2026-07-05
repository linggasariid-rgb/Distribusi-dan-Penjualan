import { callApi } from '../services/api.js';

export function initMonthDropdown(selectId, callback) {
  const select = document.getElementById(selectId);
  if (!select) return;
  callApi('getBestProductsMonths').then(function(resp) {
    if (resp.status === "success") {
      const months = resp.data;
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      select.innerHTML = '';
      months.forEach(m => {
        const parts = m.split('-');
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        const opt = document.createElement('option');
        opt.value = m;
        opt.text = label;
        if (m === currentMonth) opt.selected = true;
        select.add(opt);
      });
      if (callback) callback();
    }
  }).catch(() => {});
}
