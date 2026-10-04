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
/** 일정 제공자 슬롯 — 모듈이 manifest.calendar 로 등록하면 일정 모듈이 플랫폼 코드를 고치지 않고도 그 일정을 달력에 모은다.
 *  제공자 = { id, label, order, defaultOn?, perm?(me), load(range, ctx) → Promise<일정[]> }  ·  range = { from, to } (YYYY-MM-DD), ctx = { me }
 *  ※ 모듈 메뉴 권한과 별개다 — 일정을 볼 수 있는지는 제공자의 perm 과 각 컬렉션의 보안 규칙이 정한다(예: PJT 권한이 없어도 PJT 일정은 보인다). */
export function calendarProvidersFor(me) {
  const out = [];
  [...modules.values()].forEach((m) => (m.calendar || []).forEach((p) => { if (!p.perm || p.perm(me)) out.push(Object.assign({ module: m.id }, p)); }));
  return out.sort((a, b) => (a.order || 0) - (b.order || 0));
}
