export function getTheme() {
  return localStorage.getItem('theme') || 'light';
}

export function setTheme(theme) {
  localStorage.setItem('theme', theme);
}
