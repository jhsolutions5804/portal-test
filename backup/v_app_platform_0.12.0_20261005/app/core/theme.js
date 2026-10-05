/* 화면 모드(테마): 자동(기기 설정을 따름) / 라이트 / 다크.
 * 선택은 이 기기의 브라우저에 저장된다(localStorage). 자동이면 <html>의 data-theme 를 지우고 CSS 의 prefers-color-scheme 이 처리한다. */
const KEY = 'jh.theme';
const COLORS = { light: '#F4F7FB', dark: '#0F1623' };   // 브라우저 주소창 색(theme-color)

export const MODES = [
  { key: 'auto', label: '자동' },
  { key: 'light', label: '라이트' },
  { key: 'dark', label: '다크' }
];

export function getMode() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; }
}
export function systemPrefersDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
/** 지금 실제로 보이는 테마 */
export function effectiveTheme() {
  const m = getMode();
  return m === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : m;
}
function applyMeta(mode) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((n) => n.remove());
  const add = (color, media) => { const m = document.createElement('meta'); m.name = 'theme-color'; m.content = color; if (media) m.media = media; document.head.appendChild(m); };
  if (mode === 'auto') { add(COLORS.light, '(prefers-color-scheme: light)'); add(COLORS.dark, '(prefers-color-scheme: dark)'); }
  else add(COLORS[mode]);
}
export function applyMode(mode) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode); else root.removeAttribute('data-theme');
  applyMeta(mode === 'light' || mode === 'dark' ? mode : 'auto');
}
export function setMode(mode) {
  const m = mode === 'light' || mode === 'dark' ? mode : 'auto';
  try { if (m === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, m); } catch (e) { /* 저장 불가(사생활 보호 모드 등)여도 이번 화면에는 적용 */ }
  applyMode(m);
  return m;
}
export function initTheme() {
  applyMode(getMode());
  // 자동일 때 기기 설정이 바뀌면 주소창 색만 갱신하면 된다(화면 색은 CSS 가 알아서 바뀜)
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (getMode() === 'auto') applyMeta('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
}
