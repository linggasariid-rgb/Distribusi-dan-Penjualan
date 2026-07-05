// Decouples feature modules from app.js's central switchMenu router, so
// leaf modules (input forms, urgent-product modal, etc.) never need to
// import app.js directly -- avoids circular module dependencies.
const NAVIGATE_EVENT = 'app:navigate';

export function requestNavigate(menuName) {
  document.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: menuName }));
}

export function onNavigateRequest(handler) {
  document.addEventListener(NAVIGATE_EVENT, (e) => handler(e.detail));
}
