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
export function go(hash) { location.hash = hash; }
export function onChange(fn) { window.addEventListener('hashchange', fn); }
