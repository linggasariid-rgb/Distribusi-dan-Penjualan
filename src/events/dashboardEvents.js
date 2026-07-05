import { switchMenu } from '../router.js';
import { loadBeranda } from '../modules/dashboard/dashboard.js';
import {
  openUrgentProductsModal, closeUrgentProductsModal, viewBranchFromModal,
  openWHPCriticalModal, copyWA
} from '../modules/dashboard/distribution.js';

export function initDashboardEvents() {
  const reloadBtn = document.getElementById('btn-beranda-reload');
  if (reloadBtn) reloadBtn.addEventListener('click', loadBeranda);

  const quickActions = document.getElementById('beranda-quick-actions');
  if (quickActions) quickActions.addEventListener('click', function(e) {
    const el = e.target.closest('[data-menu]');
    if (el) switchMenu(el.dataset.menu);
  });

  const urgentCard = document.getElementById('summary-card-urgent');
  if (urgentCard) urgentCard.addEventListener('click', openUrgentProductsModal);

  const bandungCard = document.getElementById('summary-card-whp-bandung');
  if (bandungCard) bandungCard.addEventListener('click', () => openWHPCriticalModal('WHP BANDUNG'));

  const tasikCard = document.getElementById('summary-card-whp-tasikmalaya');
  if (tasikCard) tasikCard.addEventListener('click', () => openWHPCriticalModal('WHP TASIKMALAYA'));

  document.querySelectorAll('[data-action="close-urgent-modal"]').forEach(el => {
    el.addEventListener('click', closeUrgentProductsModal);
  });

  const urgentModalContent = document.getElementById('urgentProductsModalContent');
  if (urgentModalContent) urgentModalContent.addEventListener('click', function(e) {
    const el = e.target.closest('[data-action="view-branch"]');
    if (!el) return;
    viewBranchFromModal(el.dataset.branch);
    switchMenu('distribusi');
  });

  const content = document.getElementById('content');
  if (content) content.addEventListener('click', function(e) {
    const el = e.target.closest('[data-action="copy-wa"]');
    if (el) copyWA(el.dataset.key);
  });
}
