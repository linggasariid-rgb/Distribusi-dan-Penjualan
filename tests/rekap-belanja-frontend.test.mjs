import assert from 'node:assert/strict';
import { groupPerCabang } from '../src/modules/reports/rekapBelanja.js';

const items = [
  { cabang: 'GARUT', nama_customer: 'STK B', kategori: 'Stokis' },
  { cabang: 'BANDUNG', nama_customer: 'MST Z', kategori: 'Master Stokis' },
  { cabang: 'BANDUNG', nama_customer: 'MST A', kategori: 'Master Stokis' },
];
const s = groupPerCabang(items);
assert.equal(s.length, 2);
assert.equal(s[0].cabang, 'BANDUNG', 'cabang urut abjad');
assert.deepEqual(s[0].items.map(i => i.nama_customer), ['MST A', 'MST Z'], 'nama urut abjad');
assert.equal(s[1].cabang, 'GARUT');

console.log('OK: tes groupPerCabang lolos');