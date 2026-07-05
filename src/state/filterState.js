// Reads of the header branch/WHP filter <select> values, shared across the
// distribution and sales-dashboard modules.

export function getSelectedBranch() {
  return document.getElementById('branchFilter').value;
}

export function getSelectedWHP() {
  return document.getElementById('whpFilter').value;
}
