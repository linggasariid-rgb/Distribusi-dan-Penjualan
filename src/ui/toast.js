export function showToast(message, type) {
  type = type || 'success';
  var toast = document.getElementById('toast');
  var icon = toast.querySelector('i');
  var text = toast.querySelector('span');
  var icons = {
    success: 'fa-check-circle text-emerald-400',
    error: 'fa-times-circle text-red-400',
    warning: 'fa-exclamation-circle text-amber-400',
    info: 'fa-info-circle text-blue-400',
  };
  icon.className = 'fas ' + (icons[type] || icons.success) + ' text-xl';
  text.innerText = message;
  toast.classList.remove('translate-y-32', 'opacity-0');
  setTimeout(function() {
    toast.classList.add('translate-y-32', 'opacity-0');
  }, 3000);
}
