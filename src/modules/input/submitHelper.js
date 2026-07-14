import { callApi } from '../../services/api.js';
import { state } from '../../state/appState.js';
import { showConfirmModal } from '../../ui/modal.js';
import { loadData } from '../dashboard/distribution.js';
import { requestNavigate } from '../../events/navigation.js';
import { loadInputHistory } from './inputHistory.js';

// Shared "paste -> submit -> toast -> optionally offer dashboard reload"
// tail shared verbatim by Penerimaan Pabrik, Input Distribusi and Penjualan
// WHO (the other two input forms don't offer a reload, so offerReload=false).
export function submitPastedData({ rpcName, cacheKey, idPrefix, minLength = 2, button, offerReload = false, historyTable, historyContainerId }) {
  const dataToSubmit = state.pastedDataCache[cacheKey];
  const originalButtonText = button.innerHTML;

  if (!dataToSubmit || dataToSubmit.length < minLength) {
    alert('Tidak ada data. Silakan proses data terlebih dahulu.');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Menyimpan data...';

  callApi(rpcName, dataToSubmit).then(function(response) {
    if (response.status === 'success') {
      const toast = document.getElementById('toast');
      toast.querySelector('span').innerText = response.message;
      toast.classList.remove('translate-y-32', 'opacity-0');
      setTimeout(() => { toast.classList.add('translate-y-32', 'opacity-0'); }, 4000);

      document.getElementById(idPrefix + '-paste-area').value = '';
      document.getElementById(idPrefix + '-preview').innerHTML = '';
      document.getElementById(idPrefix + '-submit-container').classList.add('hidden');
      state.pastedDataCache[cacheKey] = null;

      if (historyTable && historyContainerId) loadInputHistory(historyTable, historyContainerId);

      if (offerReload) {
        showConfirmModal('Data berhasil disimpan. Muat ulang dashboard sekarang?', function() {
          loadData();
          requestNavigate('distribusi');
        });
      }
    } else {
      alert('Gagal: ' + response.message);
    }
    button.disabled = false;
    button.innerHTML = originalButtonText;
  }).catch(function(error) {
    alert('Gagal terhubung ke server: ' + error.message);
    button.disabled = false;
    button.innerHTML = originalButtonText;
  });
}
