import { processPastePabrik, submitDataPabrik, clearPabrikForm } from '../modules/input/inputPabrik.js';
import { processPasteDistribusi, submitDataDistribusi, clearDistribusiForm } from '../modules/input/inputDistribusi.js';
import { processPasteWHO, submitDataWHO, clearWhoForm } from '../modules/input/inputWho.js';
import { processPasteBIZ, submitDataBIZ, clearBizForm } from '../modules/input/inputBiz.js';
import { processPasteStokExcel, submitDataStokExcel, clearStockForm } from '../modules/input/inputStock.js';

import { processPastePenerimaanCabang, submitDataPenerimaanCabang, clearPenerimaanCabangForm } from '../modules/input/inputPenerimaanCabang.js';
import { processPasteMutasi, submitDataMutasi, clearMutasiForm } from '../modules/input/inputMutasi.js';
import { processPasteRetur, submitDataRetur, clearReturForm } from '../modules/input/inputRetur.js';

const FORMS = {
  pabrik: { process: processPastePabrik, submit: submitDataPabrik, clear: clearPabrikForm },
  distribusi: { process: processPasteDistribusi, submit: submitDataDistribusi, clear: clearDistribusiForm },
  who: { process: processPasteWHO, submit: submitDataWHO, clear: clearWhoForm },
  biz: { process: processPasteBIZ, submit: submitDataBIZ, clear: clearBizForm },
  stock: { process: processPasteStokExcel, submit: submitDataStokExcel, clear: clearStockForm },
  'penerimaan-cabang': { process: processPastePenerimaanCabang, submit: submitDataPenerimaanCabang, clear: clearPenerimaanCabangForm },
  mutasi: { process: processPasteMutasi, submit: submitDataMutasi, clear: clearMutasiForm },
  retur: { process: processPasteRetur, submit: submitDataRetur, clear: clearReturForm },
};

export function initInputEvents() {
  document.addEventListener('click', function(e) {
    const el = e.target.closest('[data-action][data-form]');
    if (!el) return;
    const form = FORMS[el.dataset.form];
    if (!form) return;
    if (el.dataset.action === 'process-paste') form.process();
    else if (el.dataset.action === 'submit-data') form.submit();
    else if (el.dataset.action === 'clear-form') form.clear();
  });
}
