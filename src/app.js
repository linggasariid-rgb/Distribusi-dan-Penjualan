import { getUserWHP, getUserRole } from './state/authState.js';
import { onNavigateRequest } from './events/navigation.js';

import { initSidebarAutohide } from './ui/sidebar.js';
import { applyTheme } from './ui/theme.js';
import { registerChartPlugins } from './ui/chart.js';
import { initConfirmModal } from './ui/modal.js';

import { updateUserBadge, applyMenuRestrictions } from './modules/login/login.js';

import { switchMenu } from './router.js';

import { initDashboardEvents } from './events/dashboardEvents.js';
import { initSalesEvents } from './events/salesEvents.js';
import { initFilterEvents } from './events/filterEvents.js';
import { initSidebarEvents } from './events/sidebarEvents.js';
import { initChatEvents } from './events/chatEvents.js';
import { initLoginEvents } from './events/loginEvents.js';
import { initInputEvents } from './events/inputEvents.js';

function init() {
  registerChartPlugins();
  initSidebarAutohide();
  applyTheme();
  initConfirmModal();
  onNavigateRequest(switchMenu);

  initSidebarEvents();
  initDashboardEvents();
  initSalesEvents();
  initFilterEvents();
  initChatEvents();
  initLoginEvents();
  initInputEvents();

  const whp = getUserWHP();
  const role = getUserRole();
  if (whp && role) {
    updateUserBadge();
    applyMenuRestrictions();
    document.getElementById('login-overlay').classList.add('hidden');
    switchMenu('beranda');
  }
}

window.addEventListener('load', init);
