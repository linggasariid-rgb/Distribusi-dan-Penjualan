export function initSidebarAutohide() {
  var sidebar = document.getElementById('sidebar');
  var mainContent = document.getElementById('main-content');
  if (!sidebar || !mainContent) return;
  var hideTimer = null;
  document.addEventListener('mousemove', function(e) {
    if (e.clientX < 15 && sidebar.classList.contains('-translate-x-full')) {
      clearTimeout(hideTimer);
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      mainContent.classList.remove('ml-0');
      mainContent.classList.add('ml-64');
    }
  });
  sidebar.addEventListener('mouseenter', function() {
    clearTimeout(hideTimer);
  });
  sidebar.addEventListener('mouseleave', function() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function() {
      sidebar.classList.remove('translate-x-0');
      sidebar.classList.add('-translate-x-full');
      mainContent.classList.remove('ml-64');
      mainContent.classList.add('ml-0');
    }, 500);
  });
}

export function closeOtherMenuGroups(exceptGroup) {
  document.querySelectorAll('.menu-group').forEach(function(group) {
    if (group === exceptGroup) return;
    const sub = group.querySelector('.sub-menu');
    const toggleLink = group.querySelector('a[data-action="toggle-menu-group"]');
    const arrow = toggleLink ? toggleLink.querySelector('.fa-chevron-right') : null;
    if (sub && !sub.classList.contains('hidden')) {
      sub.classList.add('hidden');
      if (arrow) arrow.classList.remove('rotate-90');
    }
  });
}

export function toggleMenuGroup(el) {
  const group = el.closest('.menu-group');
  const subMenu = el.parentElement.querySelector('.sub-menu');
  const arrow = el.querySelector('.fa-chevron-right');
  if (!subMenu) return;
  const isHidden = subMenu.classList.toggle('hidden');
  arrow.classList.toggle('rotate-90', !isHidden);
  if (!isHidden) closeOtherMenuGroups(group);
}

export function expandParentGroup(menuName) {
  const menuEl = document.getElementById('menu-' + menuName);
  if (!menuEl) return;
  const subMenu = menuEl.closest('.sub-menu');
  if (!subMenu) return;
  const parentGroup = subMenu.closest('.menu-group');
  if (!parentGroup) return;
  const toggleLink = parentGroup.querySelector('a[data-action="toggle-menu-group"]');
  if (toggleLink) {
    const sub = parentGroup.querySelector('.sub-menu');
    const arrow = toggleLink.querySelector('.fa-chevron-right');
    if (sub && sub.classList.contains('hidden')) {
      sub.classList.remove('hidden');
      if (arrow) arrow.classList.add('rotate-90');
    }
  }
  closeOtherMenuGroups(parentGroup);
}
