import { sidenavHtml } from '../../shared/sidenav.js?v=20261013w';
import { canAccessProject } from '../../shared/pjt-access.js?v=20261013w';
/* 옛 모듈 어댑터의 목록과 규칙 — 화면(DOM)·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 옛 모듈이 새 모듈로 바뀌면 여기서 항목을 지우고 modules/index.js 의 새 모듈 목록으로 옮긴다. */
export const PJT_FIXED = [
  { key: 'p4ph2', label: 'P4 Ph2 (FAB)', url: 'pjt/' },
  { key: 'p4ph4', label: 'P4 Ph4 (SUP)', url: 'pjt_ph4/' }
];
const isAdmin = (me) => !!(me && me.admin);

export const LEGACY_DEFS = [
  { id: 'plan', order: 10, title: '영업기획', icon: '🧭', tabbed: true, ownNav: true, url: 'gihoek/', perm: isAdmin, nav: [{ key: 'home', label: '기획 홈' }], homeLabel: '영업기획',
    // 사이드바(인사총무와 같은 방식): 새 화면으로 옮긴 구역은 native, 나머지는 구포털 기획 화면(iframe)이 탭 값으로 열린다. 회계 탭은 재무회계로 이관 예정이라 맨 아래에 임시로 둔다.
    groups: [{ key: 'plan', label: '영업기획', home: { key: 'home', label: '홈', hint: '진행 프로젝트·유효 견적·청구·미수금 요약' }, clusters: [{ label: '프로젝트', keys: ['projects'] }, { label: '영업', keys: ['comp', 'est', 'billing'] }, { label: '기획', keys: ['payout', 'partners'] }, { label: '이관 예정', keys: ['settle', 'acct'] }] }],
    sections: [{ key: 'home', label: '홈' }, { key: 'projects', label: '프로젝트', native: true }, { key: 'comp', label: '거래처', native: true }, { key: 'est', label: '견적', native: true }, { key: 'billing', label: '청구·수금', native: true }, { key: 'payout', label: '지급·정산', native: true }, { key: 'settle', label: '정산서 작성·팀별 노무비(옛 화면)' }, { key: 'partners', label: '협력사', native: true }, { key: 'acct', label: '회계(재무회계로 이관 예정)' }] },
  { id: 'hr', order: 20, title: '인사총무', icon: '👥', tabbed: true, ownNav: true, url: 'hr/', perm: isAdmin, nav: [{ key: 'home', label: '인사 홈' }], homeLabel: '인사', groups: [{ key: 'hr', label: '인사', home: { key: 'home', label: '인사 홈', hint: '요약 카드·인사 캘린더·서명/도장 관리. 세부 업무는 아래 메뉴에서 엽니다' }, clusters: [{ label: '채용', keys: ['applicants', 'postings'] }, { label: '입사', keys: ['offers', 'laborc', 'annualc', 'workers'] }, { label: '재직', keys: ['leaves', 'leavepromo', 'attendcal', 'overtimes', 'payslips', 'evals', 'interviews', 'salarytable'] }, { label: '변동', keys: ['change'] }, { label: '퇴사', keys: ['resignreqs', 'retire', 'dismissal'] }] }, { key: 'general', label: '총무', keys: ['general'], items: [['home', '개요'], ['lease', '임대'], ['vehicle', '차량'], ['drive', '운행일지'], ['asset', '자산·장비'], ['renewal', '갱신 일정']] }], sections: [{ key: 'home', label: '인사 홈', native: true }, { key: 'workers', label: '근로자 명부', native: true }, { key: 'leaves', label: '연차 현황', native: true }, { key: 'change', label: '인사 변동', native: true }, { key: 'postings', label: '공고 관리', native: true }, { key: 'applicants', label: '채용 지원자', native: true }, { key: 'offers', label: '연봉 제안서', native: true }, { key: 'annualc', label: '연봉계약서', native: true }, { key: 'laborc', label: '근로계약서', native: true }, { key: 'interviews', label: '근로자 면담', native: true }, { key: 'resignreqs', label: '휴직/퇴직 원서', native: true }, { key: 'retire', label: '퇴직금 정산', native: true }, { key: 'dismissal', label: '해고예고통지서', native: true }, { key: 'hrcal', label: '인사 캘린더', native: true }, { key: 'overtimes', label: '초과근로 현황', native: true }, { key: 'attendcal', label: '출퇴근 달력', native: true }, { key: 'leavepromo', label: '연차사용촉진', native: true }, { key: 'payslips', label: '급여명세서', native: true }, { key: 'evals', label: '인사평가', native: true }, { key: 'salarytable', label: '급여테이블', native: true }, { key: 'general', label: '총무', native: true }] },
  { id: 'pjt', order: 40, mobileTab: { order: 2, label: 'PJT', icon: '🏗️' }, title: 'PJT 관리', icon: '🏗️', tabbed: false, dynamicNav: true, perm: (me) => !!(me && (me.admin || (me.perms && me.perms.pjt) || (Array.isArray(me.pjtKeys) && me.pjtKeys.length > 0))) },   // PJT 권한자·관리자, 또는 어느 프로젝트든 참여자로 지정된 사람
  { id: 'myteam', order: 90, title: '내 팀 공수표', icon: '👷', tabbed: false, url: 'team/',
    perm: (me) => !!(me && (me.admin || (Array.isArray(me.teamLeaderIds) && me.teamLeaderIds.length > 0))), nav: [{ key: 'main', label: '내 팀 공수표' }] }
];
export const defById = (id) => LEGACY_DEFS.find((d) => d.id === id) || null;

/** PJT 세부 메뉴: 고정 PJT(종료되지 않은 것) → 경량 PJT(등록 순) → 연명부(관리자) → 종료 PJT.
 *  dyn = { ended: { p4ph2: bool, p4ph4: bool }, registry: [{ id, name, client, content, site, url }] } */
export function pjtNav(me, dyn) {
  const d = dyn || { ended: {}, registry: [] }; const loading = dyn && dyn.loaded === false;   // 프로젝트 정보를 아직 못 읽었으면 프로젝트 칩은 읽은 뒤에 보여 준다(참여자 지정 확인 전에는 숨김)
  const items = [{ key: 'home', label: 'PJT 홈', url: 'classic.html?embed=pjt-home' }];
  const can = (proj) => !dyn || dyn.loaded === undefined ? true : canAccessProject(me, proj);   // dyn 이 없던 옛 호출(시험)은 지금까지처럼 모두 보임
  if (!loading) {
    PJT_FIXED.forEach((f) => { if (!(d.ended && d.ended[f.key]) && can(d.settings && d.settings[f.key])) items.push({ key: f.key, label: f.label, url: f.url }); });
    (d.registry || []).forEach((r) => { if (can(r)) items.push({ key: 'reg_' + r.id, label: r.name || 'PJT', url: r.url || ('pjt_light/index.html?pjtId=' + encodeURIComponent(r.id)) }); });
  }
  if (me && (me.admin || (me.perms && me.perms.pjt)) || !me) items.push({ key: 'roster', label: '근로자 연명부', url: 'pjt_roster/' });   // 연명부는 PJT 권한자·관리자(프로젝트 참여자 지정만으로는 열리지 않음 — 모든 근로자 정보를 다룬다)
  items.push({ key: 'ended', label: '종료 PJT', url: 'classic.html?embed=pjt-ended' });
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
/** 두 단계 메뉴(def.groups): 위 줄은 큰 갈래(인사·총무), 아래 줄은 고른 갈래 안의 메뉴를 단계별(채용·입사·재직…)로 묶어 보여 준다. 갈래에 속하지 않은 key(옛 화면의 탭)는 첫 갈래의 "홈"으로 본다 */
export function groupOfKey(def, key) { const g = (def.groups || []).find((x) => (x.keys || []).includes(key) || (x.clusters || []).some((c) => c.keys.includes(key))); return g ? g.key : (def.groups && def.groups[0] ? def.groups[0].key : ''); }
/** 사이드바에서 현재로 표시할 항목 key: 총무는 'general/<탭>', 인사 새 화면은 그 key, 옛 화면 탭은 인사 홈('home') */
export function sideCurrentKey(def, activeKey, sub) { if (activeKey === 'general') return 'general/' + (sub || 'home'); const g = (def.groups || []).find((x) => x.clusters && x.clusters.some((c) => c.keys.includes(activeKey))); return g ? activeKey : 'home'; }
export function sideConfig(def, activeKey, sub) {
  const labelOf = (k) => { const s = (def.sections || []).find((x) => x.key === k); return s ? s.label : k; };
  const sections = [];   // 재무회계 사이드바처럼 묶음마다 머리글 + 구분선: 인사 · 채용 · 입사 · 재직 · 변동 · 퇴사 · 총무
  def.groups.forEach((g) => {
    if (g.clusters) { const top = { title: g.label, items: g.home ? [{ key: g.home.key, label: g.home.label, href: '#/' + def.id + '/' + g.home.key, hint: g.home.hint }] : [] }; sections.push(top); g.clusters.forEach((c) => { const items = c.keys.map((k) => ({ key: k, label: labelOf(k), href: '#/' + def.id + '/' + k })); if (c.keys.length === 1 && labelOf(c.keys[0]) === c.label) top.items.push(items[0]); else sections.push({ title: c.label, items }); }); }   // 묶음 제목과 메뉴 이름이 같은 한 칸짜리 묶음(예: 프로젝트)은 맨 위 구역에 합친다
    else sections.push({ title: g.label, items: (g.items || []).map(([k, l]) => ({ key: g.key + '/' + k, label: l, href: '#/' + def.id + '/' + g.key + '/' + k })) });
  });
  return { label: def.title + ' 메뉴', title: (def.icon ? def.icon + ' ' : '') + def.title, current: sideCurrentKey(def, activeKey, sub), sections };
}
function groupNavHtml(def, activeKey, esc, sub) { return sidenavHtml(sideConfig(def, activeKey, sub), 'jh-legacy__nav'); }
export function navHtml(def, items, activeKey, esc, sub) {
  if (def.groups && def.groups.length) return groupNavHtml(def, activeKey, esc, sub);
  if (def.sections && def.sections.length) {   // 옛 화면은 자기 메뉴를 쓰고, 플랫폼은 구역(인사 / 총무)만 고르게 한다 — 구역 key 는 새 모듈이 직접 그리는 화면
    const nat = def.sections.map((s) => s.key); const chips = [{ key: 'home', label: def.homeLabel || def.title, home: true }].concat(def.sections);
    return '<nav class="jh-legacy__nav" aria-label="' + esc(def.title) + ' 구역">' + chips.map((it) => '<a class="jh-legacy__chip" href="#/' + esc(def.id) + '/' + esc(it.key) + '" data-key="' + esc(it.key) + '"' + (it.home ? ' data-home="1"' : '') + ((it.home ? nat.indexOf(activeKey) === -1 : it.key === activeKey) ? ' aria-current="page"' : '') + '>' + esc(it.label) + '</a>').join('') + '</nav>';
  }
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
