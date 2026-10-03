export function parseHash(hash) {
  const h = String(hash == null ? location.hash : hash).replace(/^#/, '');
  const [pathPart, qs = ''] = h.split('?');
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  return {
    module: segs[0] || '',
    segs: segs.slice(1),
    path: '/' + segs.slice(1).join('/'),
    query: Object.fromEntries(new URLSearchParams(qs))
  };
}
/** defaults: 키별 기본값 — 기본값과 같으면 주소에서 생략한다 (예: { tab:'todo', type:'all' }) */
export function buildHash(module, path, query, defaults) {
  const q = new URLSearchParams();
  const df = defaults || {};
  Object.entries(query || {}).forEach(([k, v]) => { if (v != null && v !== '' && v !== df[k]) q.set(k, v); });
  const qs = q.toString();
  return '#/' + module + (path && path !== '/' ? path : '') + (qs ? '?' + qs : '');
}
/* 화면 이동 규칙
 *  - 새 화면으로 들어가는 이동(목록 → 문서)만 기록을 쌓는다(push).
 *  - 같은 화면 안의 상태 변경(탭·필터·검색·쪽 이동)은 기록을 쌓지 않고 현재 기록을 바꾼다(replace).
 *  그래야 뒤로가기가 '바로 직전 화면'으로 간다. */
const listeners = [];
let installed = false;
let lastHref = null;
function fire() {
  if (location.href === lastHref) return;   // popstate 와 hashchange 가 둘 다 와도 한 번만
  lastHref = location.href;
  listeners.forEach((f) => f());
}
export function onChange(fn) {
  listeners.push(fn);
  if (!installed) { installed = true; window.addEventListener('popstate', fire); window.addEventListener('hashchange', fire); }
}
export function navigate(hash, opts) {
  const o = opts || {};
  const url = location.pathname + location.search + hash;
  if (o.replace) history.replaceState(o.state === undefined ? history.state : o.state, '', url);
  else history.pushState(o.state === undefined ? null : o.state, '', url);
  lastHref = location.href;
  listeners.forEach((f) => f());
}
export function go(hash) { navigate(hash); }
