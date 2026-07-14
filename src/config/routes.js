// Endpoint routing tables consumed by services/api.js — same mapping as the
// original google.script.run -> fetch() bridge.

export const READ = {
  getSalesHubData: { url: '/api/sales-hub', params: ['whp', 'currDate', 'prevDate', 'backDate'] },
  getSalesDailyReport: { url: '/api/sales-report', params: ['dayFilter', 'filterMonth', 'startMonth', 'whp'] },
  getBestProductsMonths: { url: '/api/best-products/months', params: [] },
  getBestProductsData: { url: '/api/best-products/data', params: ['month'] },
  getControlPointData: { url: '/api/control-point', params: [] },
  getDistributionData: { url: '/api/distribution', params: ['whp'] },
  getInputHistory: { url: '/api/input-history', params: ['table'] },
  getUsers: { url: '/api/users', params: [] },
};

export const WRITE = {
  savePenerimaanPabrik: { url: '/api/save/penerimaan-pabrik', params: ['data'] },
  saveDistribusi: { url: '/api/save/distribusi', params: ['data'] },
  savePastedDataWHO: { url: '/api/save/penjualan-who', params: ['data'] },
  savePastedDataBIZ: { url: '/api/save/biz', params: ['data'] },
  savePastedDataUpdateStock: { url: '/api/save/stock', params: ['data'] },
  chatWithSalesAI: { url: '/api/chat', params: ['pesan', 'riwayat', 'userWHP'] },
  login: { url: '/api/login', params: ['username', 'password'] },
  deleteInputBatch: { url: '/api/delete-batch', params: ['table', 'createdAt'] },
};

export const BERANDA = ['getBerandaData', 'getSalesDashboardData'];
