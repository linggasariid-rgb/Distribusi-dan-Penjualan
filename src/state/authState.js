// sessionStorage-backed session/role state, shared by login, sidebar routing
// and menu-restriction logic.

export function getUserWHP() {
  return sessionStorage.getItem('user_whp') || '';
}

export function getUserRole() {
  return sessionStorage.getItem('user_role');
}

export function getUserName() {
  return sessionStorage.getItem('user_name');
}

export function setUserSession({ whp, role, name }) {
  sessionStorage.setItem('user_whp', whp);
  sessionStorage.setItem('user_role', role);
  sessionStorage.setItem('user_name', name);
}

export function clearUserSession() {
  sessionStorage.clear();
}
