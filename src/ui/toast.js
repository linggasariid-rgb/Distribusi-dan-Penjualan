export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.querySelector('span').innerText = message;
  toast.classList.remove('translate-y-32', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-32', 'opacity-0');
  }, 3000);
}
