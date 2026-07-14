import { getExportBgColor } from '../ui/theme.js';

// Shared landscape-A4 PDF export used by Laporan Harian and Penjualan
// Pertanggal (identical layout math, only the container + title differ).
export function exportPivotAsPdf(containerId, title) {
  const container = document.getElementById(containerId);
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');

  const isSidebarOpen = sidebar.classList.contains('translate-x-0');
  if (isSidebarOpen) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
    mainContent.classList.remove('ml-64');
    mainContent.classList.add('ml-0');
  }

  const area = container.querySelector('#pivot-report-area') || container;
  const filterRow = container.parentElement.querySelector('.flex');
  if (filterRow) filterRow.style.display = 'none';

  const origStyle = area.getAttribute('style') || '';
  area.style.width = '1280px';
  area.style.maxWidth = 'none';

  setTimeout(() => {
    html2canvas(area, { scale: 2, useCORS: true, backgroundColor: getExportBgColor() }).then(canvas => {
      const { jsPDF } = window.jspdf;
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pw / 2, 12, { align: 'center' });

      const imgY = 17;
      const margin = 8;
      const availW = pw - margin * 2;
      const availH = ph - imgY - margin;
      const ratio = Math.min(availW / canvas.width, availH / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const cx = (pw - imgW) / 2;
      doc.addImage(imgData, 'PNG', cx, imgY, imgW, imgH);
      doc.save(`${title}.pdf`);
    }).finally(() => {
      area.setAttribute('style', origStyle);
      if (filterRow) filterRow.style.display = '';
      sidebar.classList.add('-translate-x-full');
      sidebar.classList.remove('translate-x-0');
      mainContent.classList.add('ml-0');
      mainContent.classList.remove('ml-64');
    });
  }, 400);
}
