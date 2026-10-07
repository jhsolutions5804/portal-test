import { canAccessProject } from '../../shared/pjt-access.js?v=20261007d';
/* 옛 모듈 어댑터의 목록과 규칙 — 화면(DOM)·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 옛 모듈이 새 모듈로 바뀌면 여기서 항목을 지우고 modules/index.js 의 새 모듈 목록으로 옮긴다. */
export const PJT_FIXED = [
  { key: 'p4ph2', label: 'P4 Ph2 (FAB)', url: 'pjt/' },
  { key: 'p4ph4', label: 'P4 Ph4 (SUP)', url: 'pjt_ph4/' }
];
const isAdmin = (me) => !!(me && me.admin);

export const LEGACY_DEFS = [
  { id: 'plan', order: 10, title: '기획', icon: '🧭', tabbed: true, ownNavMobile: true, url: 'gihoek/', perm: isAdmin,
    nav: [['home', '기획 홈'], ['pjt', '프로젝트'], ['comp', '거래처'], ['est', '견적'], ['settle', '정산'], ['acct', '회계']].map(([key, label]) => ({ key, label })) },
  { id: 'hr', order: 20, title: '인사', icon: '👥', tabbed: true, ownNav: true, url: 'hr/', perm: isAdmin, nav: [{ key: 'home', label: '인사 홈' }] },
  { id: 'pjt', order: 40, mobileTab: { order: 2, label: 'PJT', icon: '🏗️' }, title: 'PJT 관리', icon: '🏗️', tabbed: false, dynamicNav: true, perm: (me) => !!(me && (me.admin || (me.perms && me.perms.pjt) || (Array.isArray(me.pjtKeys) && me.pjtKeys.length > 0))) },   // PJT 권한자·관리자, 또는 어느 프로젝트든 참여자로 지정된 사람
  { id: 'myteam', order: 90, title: '내 팀 공수표', icon: '👷', tabbed: false, url: 'team/',
    perm: (me) => !!(me && (me.admin || (Array.isArray(me.teamLeaderIds) && me.teamLeaderIds.length > 0))), nav: [{ key: 'main', label: '내 팀 공수표' }] }
];
export const defById = (id) => LEGACY_DEFS.find((d) => d.id === id) || null;

/** PJT 세부 메뉴: 고정 PJT(종료되지 않은 것) → 경량 PJT(등록 순) → 연명부(관리자) → 종료 PJT.
 *  dyn = { ended: { p4ph2: bool, p4ph4: bool }, registry: [{ id, name, client, content, site, url }] } */
export function pjtNav(me, dyn) {
  const d = dyn || { ended: {}, registry: [] }; const loading = dyn && dyn.loaded === false;   // 프로젝트 정보를 아직 못 읽었으면 프로젝트 칩은 읽은 뒤에 보여 준다(참여자 지정 확인 전에는 숨김)
  const items = [{ key: 'home', label: 'PJT 홈', url: 'index.html?embed=pjt-home' }];
  const can = (proj) => !dyn || dyn.loaded === undefined ? true : canAccessProject(me, proj);   // dyn 이 없던 옛 호출(시험)은 지금까지처럼 모두 보임
  if (!loading) {
    PJT_FIXED.forEach((f) => { if (!(d.ended && d.ended[f.key]) && can(d.settings && d.settings[f.key])) items.push({ key: f.key, label: f.label, url: f.url }); });
    (d.registry || []).forEach((r) => { if (can(r)) items.push({ key: 'reg_' + r.id, label: r.name || 'PJT', url: r.url || ('pjt_light/index.html?pjtId=' + encodeURIComponent(r.id)) }); });
  }
  if (me && (me.admin || (me.perms && me.perms.pjt)) || !me) items.push({ key: 'roster', label: '근로자 연명부', url: 'pjt_roster/' });   // 연명부는 PJT 권한자·관리자(프로젝트 참여자 지정만으로는 열리지 않음 — 모든 근로자 정보를 다룬다)
  items.push({ key: 'ended', label: '종료 PJT', url: 'index.html?embed=pjt-ended' });
  return items;
}
export function itemsFor(def, me, dyn) { return def.dynamicNav ? pjtNav(me, dyn) : def.nav; }
export const firstKey = (def, me, dyn) => { const it = itemsFor(def, me, dyn); return it && it.length ? it[0].key : 'home'; };
export function resolveItem(def, key, me, dyn) {
  if (def.ownNav && key && /^[A-Za-z0-9_-]{1,24}$/.test(key)) return { key, label: key };   // 자체 메뉴를 쓰는 모듈(인사)은 칸 목록이 없으므로, 주소·메시지의 칸 값을 그대로 받아 옛 화면이 해석한다(모르는 값은 옛 화면이 홈으로)
  const it = itemsFor(def, me, dyn) || [];
  const hit = it.find((x) => x.key === key); if (hit) return hit;
  // 프로젝트 정보를 아직 읽는 중(칩이 아직 없음)에 주소가 프로젝트를 가리키면 그대로 연다 — 일정 링크·북마크로 처음 들어와도 PJT 홈으로 떨어지지 않게. 접근 여부는 각 프로젝트 화면의 입장 검사가 다시 판정한다.
  if (def.dynamicNav && dyn && dyn.loaded === false && key) {
    const fx = PJT_FIXED.find((f) => f.key === key); if (fx) return { key: fx.key, label: fx.label, url: fx.url };
    if (/^reg_[A-Za-z0-9_-]{1,40}$/.test(key)) return { key, label: 'PJT', url: 'pjt_light/index.html?pjtId=' + encodeURIComponent(key.slice(4)) };
  }
  return it[0] || null;
}
/** 옛 페이지 주소: 기본 폴더 + 항목 주소 + via=portal(임베드 모드) + tab(탭형만) + admin=1(관리자). base 는 LEGACY_BASE 를 해석한 절대 주소 */
export const PJT_TABS = ['attend', 'schedule', 'att', 'sched'];   // 주소로 바로 열 수 있는 PJT 탭: 근태(출역·공수 체크)·일정 (FAB·SUP = attend·schedule, 경량 = att·sched)
export function buildUrl(def, item, me, base, cacheBust, tab) {
  const rel = (item && item.url) || def.url || '';
  let u = String(base || '') + rel;
  const sep = () => (u.indexOf('?') === -1 ? '?' : '&');
  u += sep() + 'via=portal';
  if (def.tabbed && item && item.key) u += '&tab=' + encodeURIComponent(item.key);
  else if (!def.tabbed && tab && PJT_TABS.indexOf(tab) !== -1 && item && item.key !== 'home' && item.key !== 'ended' && item.key !== 'roster') u += '&tab=' + tab;
  if (isAdmin(me)) u += '&admin=1';
  if (cacheBust) u += '&_cb=' + cacheBust;
  return u;
}
export function navHtml(def, items, activeKey, esc) {
  if (!items || items.length < 2 || def.ownNav) return '';
  return '<nav class="jh-legacy__nav' + (def.ownNavMobile ? ' jh-legacy__nav--wide' : '') + '" aria-label="' + esc(def.title) + ' 세부 메뉴">' + items.map((it) =>
    '<a class="jh-legacy__chip" href="#/' + esc(def.id) + '/' + esc(it.key) + '" data-key="' + esc(it.key) + '"' + (it.key === activeKey ? ' aria-current="page"' : '') + '>' + esc(it.label) + '</a>').join('') + '</nav>';
}
/** 출역·공수 체크할 프로젝트 목록(폰 바로가기): 종료되지 않은 고정 PJT + 경량 PJT. hash 는 해당 프로젝트의 근태 탭 */
export function attendTargets(dyn, me) {
  const d = dyn || { ended: {}, registry: [] }; const out = []; const can = (proj) => !me || !dyn || dyn.loaded === undefined ? true : canAccessProject(me, proj);   // 참여자로 지정되지 않은 프로젝트는 고르지 못한다
  PJT_FIXED.forEach((f) => { if (!(d.ended && d.ended[f.key]) && can(d.settings && d.settings[f.key])) out.push({ key: f.key, label: f.label, hash: '#/pjt/' + f.key + '?tab=attend' }); });
  (d.registry || []).forEach((r) => { if (can(r)) out.push({ key: 'reg_' + r.id, label: r.name || 'PJT', hash: '#/pjt/reg_' + encodeURIComponent(r.id) + '?tab=att' }); });
  return out;
}
