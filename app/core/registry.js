const modules = new Map();
export function register(manifest) { modules.set(manifest.id, manifest); }
export function get(id) { return modules.get(id) || null; }
export function visibleFor(me) {
  return [...modules.values()].filter(m => !m.perm || m.perm(me));
}
/** 플랫폼 홈에 놓을 위젯 — 모듈이 manifest.widgets 로 등록하면 플랫폼 코드를 고치지 않아도 홈에 나타난다.
 * 위젯 = { id, order, wide?, perm?(me), mount(slot, ctx) }  ·  ctx = { me, setBadge } */
export function widgetsFor(me) {
  const out = [];
  visibleFor(me).forEach((m) => (m.widgets || []).forEach((w) => { if (!w.perm || w.perm(me)) out.push(Object.assign({ module: m.id }, w)); }));
  return out.sort((a, b) => (a.order || 0) - (b.order || 0));
}
