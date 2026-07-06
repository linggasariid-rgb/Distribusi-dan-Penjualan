import { callApi } from '../../services/api.js';
import { getExportBgColor } from '../../ui/theme.js';
import { showToast } from '../../ui/toast.js';

let cpData = [];

export function loadControlPoint() {
  const content = document.getElementById('cp-dashboard-content');
  content.innerHTML = '<div class="col-span-full text-center py-20"><div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div></div>';
  document.getElementById('cp-summary-bar').style.display = 'none';
  if (document.getElementById('btn-screenshot-cp')) document.getElementById('btn-screenshot-cp').disabled = true;

  callApi('getControlPointData').then(function(data) {
    if (document.getElementById('btn-screenshot-cp')) document.getElementById('btn-screenshot-cp').disabled = false;
    if (data && data.error) {
      content.innerHTML = '<div class="col-span-full p-6 rounded-2xl border font-bold" style="background:var(--color-danger-light);color:var(--color-danger);border-color:rgba(220,38,38,0.15)">' + data.error + '</div>';
      return;
    }
    cpData = data;
    renderControlPointDashboard(data);
    renderControlPointSummaryBar(data);
    populateReportCardCP(data);
  }).catch(function(err) {
    if (btn) btn.disabled = false;
    content.innerHTML = '<div class="col-span-full p-6 rounded-2xl border font-bold" style="background:var(--color-danger-light);color:var(--color-danger);border-color:rgba(220,38,38,0.15)">Gagal memuat data: ' + (err.message || err) + '</div>';
  });
}

export function renderControlPointSummaryBar(data) {
  const bar = document.getElementById('cp-summary-bar');
  const sesuai = data.filter(d => d.status === 'MATCH').length;
  const selisih = data.filter(d => d.status === 'MISMATCH').length;
  const now = new Date().toLocaleString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  bar.innerHTML = `
    <span class="badge-success flex items-center gap-2" style="padding:0.5rem 0.75rem">
      <span class="w-2 h-2 rounded-full" style="background:var(--color-success);display:inline-block"></span>${sesuai} Cabang Sesuai
    </span>
    ${selisih > 0 ? `<span class="badge-danger flex items-center gap-2" style="padding:0.5rem 0.75rem">
      <span class="w-2 h-2 rounded-full dot-pulse" style="background:var(--color-danger);display:inline-block"></span>${selisih} Cabang Selisih
    </span>` : ''}
    <span style="background:var(--color-bg-alt);color:var(--color-text-muted);font-weight:600;font-size:0.75rem;padding:0.5rem 0.75rem;border-radius:var(--radius-md)">${now}</span>
  `;
  bar.style.display = 'flex';
}

export function renderControlPointDashboard(data) {
  const content = document.getElementById('cp-dashboard-content');
  if (!data.length) {
    content.innerHTML = '<div class="col-span-full text-center py-20" style="color:var(--color-text-muted)">Tidak ada data.</div>';
    return;
  }
  let html = '';
  data.forEach(item => {
    const isMatch = item.status === 'MATCH';
    let detailHtml = '';
    if (!isMatch) {
      const produkCards = item.details.map(d => `
        <div class="card p-3 mb-2" style="border-color:rgba(220,38,38,0.1)">
          <div class="text-[11px] font-black uppercase tracking-tight mb-2" style="color:var(--color-text)">${d.produk}</div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-md p-2" style="background:var(--color-bg-alt)">
              <div class="text-[9px] font-semibold" style="color:var(--color-text-muted)">BIZ</div>
              <div class="text-[13px] font-bold" style="color:var(--color-text)">${d.biz}</div>
            </div>
            <div class="rounded-md p-2" style="background:var(--color-bg-alt)">
              <div class="text-[9px] font-semibold" style="color:var(--color-text-muted)">EXCEL</div>
              <div class="text-[13px] font-bold" style="color:var(--color-text)">${d.excel}</div>
            </div>
            <div class="rounded-md p-2" style="background:var(--color-danger-light)">
              <div class="text-[9px] font-semibold" style="color:var(--color-danger)">SELISIH</div>
              <div class="text-[13px] font-black" style="color:var(--color-danger)">${d.selisih}</div>
            </div>
          </div>
        </div>
      `).join('');
      detailHtml = `
        <div class="mt-3 pt-3" style="border-top:1px solid rgba(220,38,38,0.1)">
          <div class="text-[9px] font-black uppercase tracking-widest mb-2" style="color:var(--color-danger)">Detail Selisih</div>
          <div class="max-h-72 overflow-y-auto">${produkCards}</div>
        </div>
      `;
    }
    html += `
      <div class="card p-5 transition-all duration-200 ${isMatch ? 'cp-card-match' : 'cp-card-mismatch'}">
        <div class="flex justify-between items-start mb-3">
          <span class="text-[10px] font-black uppercase tracking-wider" style="color:var(--color-text-muted)">${item.cabang}</span>
          <span class="w-2.5 h-2.5 rounded-full ${isMatch ? '' : 'dot-pulse'} inline-block mt-0.5" style="background:${isMatch ? 'var(--color-success)' : 'var(--color-danger)'}"></span>
        </div>
        <div class="text-2xl font-black tracking-tight" style="color:${isMatch ? 'var(--color-success)' : 'var(--color-danger)'}">
          ${isMatch ? 'SESUAI' : 'ADA SELISIH'}
        </div>
        ${detailHtml}
      </div>
    `;
  });
  content.innerHTML = html;
}

export function populateReportCardCP(data) {
  const card = document.getElementById('cp-report-card');
  const selisihCount = data.filter(d => d.status === 'MISMATCH').length;
  const now = new Date().toLocaleString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const badgeHtml = selisihCount > 0
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:4px 10px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:52px;">
        <div style="font-size:20px;font-weight:900;color:#dc2626;line-height:1;">${selisihCount}</div>
        <div style="font-size:7px;color:#991b1b;font-weight:700;letter-spacing:0.5px;">SELISIH</div>
       </div>`
    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:4px 10px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:52px;">
        <div style="font-size:10px;font-weight:700;color:#16a34a;line-height:1.4;">SEMUA</div>
        <div style="font-size:7px;color:#15803d;font-weight:700;">SESUAI ✓</div>
       </div>`;

  const rowsHtml = data.map(item => {
    if (item.status === 'MATCH') {
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:5px;margin-bottom:3px;">
        <span style="font-size:10px;font-weight:600;color:#374151;">${item.cabang}</span>
        <span style="font-size:10px;font-weight:800;color:#16a34a;">SESUAI ✓</span>
      </div>`;
    }
    const produkHtml = item.details.map(d => `
      <div style="background:#fff;border:1px solid #fee2e2;border-radius:4px;padding:5px 7px;margin-bottom:3px;">
        <div style="font-size:8px;font-weight:800;color:#1e293b;margin-bottom:3px;">${d.produk}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;">
          <div style="background:#f8fafc;border-radius:3px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="font-size:6px;color:#64748b;font-weight:600;">BIZ</div>
            <div style="font-size:9px;font-weight:700;color:#1e293b;">${d.biz}</div>
          </div>
          <div style="background:#f8fafc;border-radius:3px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="font-size:6px;color:#64748b;font-weight:600;">EXCEL</div>
            <div style="font-size:9px;font-weight:700;color:#1e293b;">${d.excel}</div>
          </div>
          <div style="background:#fef2f2;border-radius:3px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="font-size:6px;color:#ef4444;font-weight:600;">SELISIH</div>
            <div style="font-size:9px;font-weight:800;color:#dc2626;">${d.selisih}</div>
          </div>
        </div>
      </div>`).join('');
    return `
      <div style="background:#fef2f2;border-left:3px solid #ef4444;border:1px solid #fecaca;border-radius:5px;overflow:hidden;margin-bottom:3px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;">
          <span style="font-size:10px;font-weight:800;color:#991b1b;">${item.cabang}</span>
          <span style="font-size:10px;font-weight:800;color:#dc2626;">SELISIH ✗</span>
        </div>
        <div style="background:#fff5f5;padding:6px 8px;border-top:1px solid #fecaca;">${produkHtml}</div>
      </div>`;
  }).join('');

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #1e293b;">
      <div>
        <div style="font-size:14px;font-weight:900;color:#1e293b;font-style:italic;letter-spacing:-0.5px;">SND SUPPORT</div>
        <div style="font-size:8px;color:#64748b;font-weight:600;margin-top:1px;">CONTROL POINT STOCK · ${now}</div>
      </div>
      ${badgeHtml}
    </div>
    <div>${rowsHtml}</div>
    <div style="margin-top:8px;padding-top:6px;border-top:1px solid #f1f5f9;text-align:center;font-size:7px;color:#94a3b8;font-weight:600;letter-spacing:0.5px;">
      Powered by ATR built by SND Support, Tridaya Sinergi Indonesia
    </div>
  `;
}

export async function takeScreenshotCP() {
  if (!cpData.length) return;
  const btn = document.getElementById('btn-screenshot-cp');
  const card = document.getElementById('cp-report-card');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Memproses...';
  try {
    const canvas = await html2canvas(card, {
      scale: 2, useCORS: true, logging: false, backgroundColor: getExportBgColor()
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast('Screenshot tersalin!');
  } catch (err) {
    console.error('Screenshot gagal:', err);
    showToast('Gagal screenshot');
  }
  btn.innerHTML = '<i class="fas fa-camera mr-2"></i>Screenshot';
  btn.disabled = false;
}

export function copyTeksWA() {
  const tgl = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const jam = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit'
  });
  const teks = 'Terlampir hasil Control Point BIZ dan Stok Excel ' + tgl + ' pukul ' + jam;
  navigator.clipboard.writeText(teks).then(() => {
    showToast('Teks WA tersalin!');
  });
}
