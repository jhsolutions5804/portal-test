export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function escMultiline(s) { return esc(s).replace(/\r?\n/g, '<br>'); }
export function money(n) {
  const v = Number(String(n == null ? '' : n).replace(/,/g, ''));
  return isFinite(v) && String(n).trim() !== '' ? v.toLocaleString('ko-KR') : '';
}
let toastTimer = null;
export function toast(msg) {
  let el = document.getElementById('jh-toast');
  if (!el) { el = document.createElement('div'); el.id = 'jh-toast'; el.className = 'jh-toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('is-show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
}
