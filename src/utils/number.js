export function formatNumber(n) {
  return Number(n).toLocaleString('id-ID');
}

export function formatNum(val) {
  return val > 0 ? val.toLocaleString('id-ID') : '<span style="color:var(--color-text-muted)">&ndash;</span>';
}
