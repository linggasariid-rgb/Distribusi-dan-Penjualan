import assert from 'node:assert/strict';
import { findNamaColumn } from '../worker/src/routes/save-penjualan-who.js';

assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'TANGGAL', 'NAMA CUSTOMER', 'SPS TSI']), 4, 'NAMA CUSTOMER terdeteksi');
assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'TANGGAL', 'NAMA PDM', 'SPS TSI']), 4, 'NAMA PDM tetap terdeteksi');
assert.equal(findNamaColumn(['NAMA PEMBELI CUSTOMER', 'SPS TSI']), 0, 'header mengandung NAMA+CUSTOMER');
assert.equal(findNamaColumn(['BULAN', 'cabang', 'TIPE CUSTOMER', 'SPS TSI']), -1, 'tanpa kolom nama');

console.log('OK: tes findNamaColumn lolos');