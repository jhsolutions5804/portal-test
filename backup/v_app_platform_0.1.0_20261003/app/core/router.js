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
export function buildHash(module, path, query) {
  const q = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => { if (v != null && v !== '' && v !== 'all') q.set(k, v); });
  const qs = q.toString();
  return '#/' + module + (path && path !== '/' ? path : '') + (qs ? '?' + qs : '');
}
export function go(hash) { location.hash = hash; }
export function onChange(fn) { window.addEventListener('hashchange', fn); }
