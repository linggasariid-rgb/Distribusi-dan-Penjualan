import { doLogin, doLogout } from '../modules/login/login.js';

export function initLoginEvents() {
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);

  const logoutBtn = document.getElementById('sidebar-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  document.getElementById('login-pass').addEventListener('keydown', function(e){
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-user').addEventListener('keydown', function(e){
    if (e.key === 'Enter') document.getElementById('login-pass').focus();
  });
}
