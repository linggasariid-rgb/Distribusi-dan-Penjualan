import { state } from '../../state/appState.js';

export function renderFormOrder() {
  const container = document.getElementById('form-order-content');
  if (!state.gData || !state.gData.result) {
    container.innerHTML = `<p class="p-8 text-center text-slate-500">Data stok tidak tersedia. Silakan segarkan data.</p>`;
    return;
  }

  // We only care about Branches (Cabang), not WHP.
  let branches = [];
  for (const branchKey in state.gData.result) {
    branches.push({ 
      id: branchKey, 
      name: state.gData.result[branchKey].nama, 
      data: state.gData.result[branchKey] 
    });
  }

  branches.sort((a, b) => a.name.localeCompare(b.name));

  // Find product names for Kopi Mana Kopi and Kopi Original
  const allProducts = state.gData.productList || [];
  const kmkName = allProducts.find(p => p.toLowerCase().includes('mana kopi') || p.toLowerCase() === 'kmk') || 'Kopi Mana Kopi';
  const koName = allProducts.find(p => p.toLowerCase().includes('original') || p.toLowerCase() === 'ko') || 'Kopi Original';

  // Build the form UI
  let html = `
    <div class="flex flex-col lg:flex-row gap-6 p-4">
      <!-- Tabel Input -->
      <div class="w-full lg:w-3/5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-100 bg-slate-50">
          <h2 class="text-lg font-bold text-slate-800"><i class="fas fa-edit text-green-500 mr-2"></i>Input Form Order</h2>
          <p class="text-xs text-slate-500 mt-1">Isi jumlah order. Stok saat ini ditampilkan sebagai referensi.</p>
        </div>
        <div class="overflow-auto max-h-[60vh]">
          <table class="w-full text-sm text-left border-collapse">
            <thead class="sticky top-0 bg-slate-100 shadow-sm z-10">
              <tr class="text-slate-600 text-xs uppercase">
                <th class="px-4 py-3 font-bold border-b border-slate-200">Cabang</th>
                <th class="px-4 py-3 font-bold border-b border-slate-200 text-center bg-blue-50/50">Stok KMK</th>
                <th class="px-4 py-3 font-bold border-b border-slate-200">Order KMK</th>
                <th class="px-4 py-3 font-bold border-b border-slate-200 text-center bg-blue-50/50">Stok KO</th>
                <th class="px-4 py-3 font-bold border-b border-slate-200">Order KO</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
  `;

  branches.forEach(branch => {
    let stockKMK = branch.data.produk[kmkName] ? branch.data.produk[kmkName].currentStock : 0;
    let stockKO = branch.data.produk[koName] ? branch.data.produk[koName].currentStock : 0;
    
    html += `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">${branch.name}</td>
        <td class="px-4 py-3 text-center text-slate-500 bg-blue-50/20">${stockKMK.toLocaleString('id-ID')}</td>
        <td class="px-4 py-2">
          <input type="number" min="0" class="input order-input-kmk" data-branch="${branch.name}" style="padding:0.3rem 0.5rem; width:80px; text-align:center" placeholder="0">
        </td>
        <td class="px-4 py-3 text-center text-slate-500 bg-blue-50/20">${stockKO.toLocaleString('id-ID')}</td>
        <td class="px-4 py-2">
          <input type="number" min="0" class="input order-input-ko" data-branch="${branch.name}" style="padding:0.3rem 0.5rem; width:80px; text-align:center" placeholder="0">
        </td>
      </tr>
    `;
  });

  html += `
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Preview WA -->
      <div class="w-full lg:w-2/5">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-4">
          <div class="p-5 border-b border-slate-100 bg-green-50 flex justify-between items-center">
            <div>
              <h2 class="text-lg font-bold text-green-800"><i class="fab fa-whatsapp mr-2"></i>Preview WhatsApp</h2>
            </div>
            <button id="btn-copy-order" class="btn btn-primary btn-sm py-1 px-3 shadow-md">
              <i class="fas fa-copy mr-1"></i>Salin Teks
            </button>
          </div>
          <div class="p-5">
            <textarea id="wa-preview-text" class="w-full font-mono text-sm p-4 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500" style="height: 50vh; resize: none;" readonly></textarea>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Attach event listeners
  const inputs = container.querySelectorAll('input[type="number"]');
  inputs.forEach(input => {
    input.addEventListener('input', generateWAText);
  });

  document.getElementById('btn-copy-order').addEventListener('click', () => {
    const text = document.getElementById('wa-preview-text').value;
    if (text.trim() === '') return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-order');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<i class="fas fa-check mr-1"></i>Tersalin!`;
      btn.classList.add('bg-green-600');
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('bg-green-600');
      }, 2000);
    });
  });
  
  generateWAText();
}

function generateWAText() {
  const container = document.getElementById('form-order-content');
  if (!container) return;

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const dateStr = `${dd}/${mm}/${yyyy}`;

  let text = `Assalamu'alaikum Wr.Wb.\nMohon Maaf pa Kyai..\n\n`;
  let hasOrder = false;

  const rows = container.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const branchName = row.querySelector('.order-input-kmk').getAttribute('data-branch');
    const kmkVal = parseInt(row.querySelector('.order-input-kmk').value) || 0;
    const koVal = parseInt(row.querySelector('.order-input-ko').value) || 0;

    if (kmkVal > 0 || koVal > 0) {
      hasOrder = true;
      text += `Order ${branchName} Tgl ${dateStr} :\n`;
      if (kmkVal > 0) {
        text += `» Kopi Mana Kopi = ${kmkVal.toLocaleString('id-ID')} box\n`;
      }
      if (koVal > 0) {
        text += `» Kopi Original = ${koVal.toLocaleString('id-ID')} box\n`;
      }
      text += `\n`;
    }
  });

  if (hasOrder) {
    text += `Terima Kasih. Wassalamualaikum Wr.Wb`;
  } else {
    text = `Assalamu'alaikum Wr.Wb.\nMohon Maaf pa Kyai..\n\n(Belum ada order yang diinput)\n\nTerima Kasih. Wassalamualaikum Wr.Wb`;
  }

  const textarea = document.getElementById('wa-preview-text');
  if (textarea) {
    textarea.value = text;
  }
}
