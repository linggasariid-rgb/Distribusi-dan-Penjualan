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
  getPrices: { url: '/api/prices', params: [] },
  getRekapBelanja: { url: '/api/report-belanja-stokis', params: ['month'] },
  getBandingkanBelanja: { url: '/api/report-belanja-banding', params: ['month', 'banding'] },
  getKontakMitra: { url: '/api/kontak-mitra', params: [] },
  getTransactionHistory: { url: '/api/transaction-history', params: ['table', 'page', 'limit', 'startDate', 'endDate'] }
};

export const WRITE = {
  savePenerimaanPabrik: { url: '/api/save/penerimaan-pabrik', params: ['data'] },
  saveDistribusi: { url: '/api/save/distribusi', params: ['data'] },
  savePenerimaanCabang: { url: '/api/save/penerimaan-cabang', params: ['data'] },
  saveMutasi: { url: '/api/save/mutasi', params: ['data'] },
  saveRetur: { url: '/api/save/retur', params: ['data'] },
  savePastedDataWHO: { url: '/api/save/penjualan-who', params: ['data'] },
  savePastedDataBIZ: { url: '/api/save/biz', params: ['data'] },
  savePastedDataUpdateStock: { url: '/api/save/stock', params: ['data'] },
  chatWithSalesAI: { url: '/api/chat', params: ['pesan', 'riwayat', 'userWHP'] },
  login: { url: '/api/login', params: ['username', 'password'] },
  deleteInputBatch: { url: '/api/delete-batch', params: ['table', 'createdAt'] },
  deleteRow: { url: '/api/delete-row', params: ['table', 'id'] },
  savePrices: { url: '/api/prices', params: ['prices'] },
  simpanKontakMitra: { url: '/api/kontak-mitra', params: ['rows'] },
  hapusKontakMitra: { url: '/api/kontak-mitra', params: ['clear'] }
};

export const BERANDA = ['getBerandaData', 'getSalesDashboardData'];
