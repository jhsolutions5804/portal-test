import { sidenavHtml } from '../../shared/sidenav.js?v=20261031a';
import { canAccessProject } from '../../shared/pjt-access.js?v=20261031a';
import { financePerm } from '../../shared/finance-perm.js?v=20261031a';
import { isEvalUser, isEvalOps } from '../../shared/eval-perm.js?v=20261031a';
import { companyPerm } from '../../shared/company-perm.js?v=20261031a';
import { isProjectKey } from '../../shared/pjt-key.js?v=20261031a';
export { isProjectKey };
/* 옛 모듈 어댑터의 목록과 규칙 — 화면(DOM)·네트워크 없이 시험할 수 있는 순수 함수만 둔다.
 * 옛 모듈이 새 모듈로 바뀌면 여기서 항목을 지우고 modules/index.js 의 새 모듈 목록으로 옮긴다. */
const isAdmin = (me) => !!(me && me.admin);

export const LEGACY_DEFS = [
  { id: 'plan', order: 10, title: '영업기획', icon: '🧭', tabbed: true, ownNav: true, url: 'gihoek/', perm: isAdmin, nav: [{ key: 'home', label: '기획 홈' }], homeLabel: '영업기획',
    // 사이드바(인사총무와 같은 방식): 새 화면으로 옮긴 구역은 native, 나머지는 구포털 기획 화면(iframe)이 탭 값으로 열린다. 회계 탭은 재무회계로 이관 예정이라 맨 아래에 임시로 둔다.
    groups: [{ key: 'plan', label: '영업기획', home: { key: 'home', label: '홈', hint: '진행 프로젝트·유효 견적·청구·미수금 요약' }, clusters: [{ label: '프로젝트', keys: ['projects'] }, { label: '월말 마감', keys: ['closing', 'monthly'] }, { label: '영업', keys: ['comp', 'est', 'billing'] }, { label: '기획', keys: ['payout', 'teamlabor', 'partners', 'contracts'] }, { label: '이관 예정', keys: ['acct'] }] }],
    sections: [{ key: 'home', label: '홈', native: true }, { key: 'projects', label: '프로젝트', native: true }, { key: 'closing', label: '월말 마감', native: true }, { key: 'monthly', label: '월간 보고서', native: true }, { key: 'comp', label: '거래처', native: true }, { key: 'est', label: '견적', native: true }, { key: 'billing', label: '청구·수금', native: true }, { key: 'payout', label: '지급·정산', native: true }, { key: 'teamlabor', label: '팀별 노무비', native: true }, { key: 'partners', label: '협력사', native: true }, { key: 'contracts', label: '위탁 계약서', native: true }, { key: 'acct', label: '비용장부 대조', native: true }] },
  { id: 'hr', order: 20, title: '인사총무', icon: '👥', tabbed: true, ownNav: true, url: 'hr/', perm: isAdmin, nav: [{ key: 'home', label: '인사 홈' }], homeLabel: '인사', groups: [{ key: 'hr', label: '인사', home: { key: 'home', label: '인사 홈', hint: '요약 카드·인사 캘린더·서명/도장 관리. 세부 업무는 아래 메뉴에서 엽니다' }, clusters: [{ label: '채용', keys: ['applicants', 'postings'] }, { label: '입사', keys: ['offers', 'laborc', 'annualc', 'workers'] }, { label: '재직', keys: ['leaves', 'leavepromo', 'attendcal', 'payslips', 'ledger', 'insurance', 'evals', 'interviews', 'salarytable'] }, { label: '변동', keys: ['change'] }, { label: '퇴사', keys: ['resignreqs', 'retire', 'dismissal'] }] }, { key: 'general', label: '총무', keys: ['general'], items: [['home', '개요'], ['lease', '임대'], ['vehicle', '차량'], ['drive', '운행일지'], ['asset', '자산·장비'], ['credit', '외상 장부'], ['renewal', '갱신 일정']] }], sections: [{ key: 'home', label: '인사 홈', native: true }, { key: 'workers', label: '근로자 명부', native: true }, { key: 'leaves', label: '연차 현황', native: true }, { key: 'change', label: '인사 변동', native: true }, { key: 'postings', label: '공고 관리', native: true }, { key: 'applicants', label: '채용 지원자', native: true }, { key: 'offers', label: '연봉 제안서', native: true }, { key: 'annualc', label: '연봉계약서', native: true }, { key: 'laborc', label: '근로계약서', native: true }, { key: 'interviews', label: '근로자 면담', native: true }, { key: 'resignreqs', label: '휴직/퇴직 원서', native: true }, { key: 'retire', label: '퇴직금 정산', native: true }, { key: 'dismissal', label: '해고예고통지서', native: true }, { key: 'hrcal', label: '인사 캘린더', native: true }, { key: 'overtimes', label: '초과근로 현황(출퇴근·초과근로로 이동)', native: true }, { key: 'attendcal', label: '출퇴근·초과근로', native: true }, { key: 'leavepromo', label: '연차사용촉진', native: true }, { key: 'payslips', label: '급여명세서', native: true }, { key: 'ledger', label: '임금대장', native: true }, { key: 'insurance', label: '4대보험 대조', native: true }, { key: 'evals', label: '인사평가', native: true }, { key: 'salarytable', label: '급여테이블', native: true }, { key: 'general', label: '총무', native: true }] },
  { id: 'finance', order: 25, title: '재무회계', icon: '📒', tabbed: true, ownNav: true, perm: financePerm, nav: [{ key: 'home', label: '개요' }], homeLabel: '재무회계',
    // 사이드바는 인사총무·영업기획과 같은 공용 틀 — 모든 화면이 새 화면(구역)이라 옛 화면(iframe)은 없다
    groups: [{ key: 'finance', label: '현황', home: { key: 'home', label: '개요', hint: '전표·확인 필요·손익·재무상태 요약' }, clusters: [{ label: '입력', keys: ['entries', 'expense', 'import'] }, { label: '보고', keys: ['reports', 'monthly', 'forecast'] }, { label: '정산', keys: ['gap', 'pjt'] }, { label: '설정', keys: ['rules', 'opening', 'settings'] }] }],
    sections: [{ key: 'home', label: '개요', native: true }, { key: 'entries', label: '전표', native: true }, { key: 'expense', label: '비용 입력', native: true }, { key: 'import', label: '가져오기', native: true }, { key: 'reports', label: '재무제표', native: true }, { key: 'monthly', label: '월간 수지', native: true }, { key: 'forecast', label: '예측', native: true }, { key: 'gap', label: '이엔지 정산', native: true }, { key: 'pjt', label: '프로젝트 표시', native: true }, { key: 'rules', label: '규칙', native: true }, { key: 'opening', label: '개시 재산', native: true }, { key: 'settings', label: '설정', native: true }] },
  { id: 'company', order: 45, title: '회사', icon: '🏢', tabbed: true, ownNav: true, perm: companyPerm, nav: [{ key: 'org', label: '조직도' }], homeLabel: '회사',
    // 사이드바는 인사총무·재무회계와 같은 공용 틀 — 상단 탭이던 조직도·규정·직원 관리·열람 기록이 메뉴가 된다(직원 관리·열람 기록은 관리자만)
    groups: [{ key: 'company', label: '회사 정보', home: { key: 'org', label: '조직도', hint: '본부·팀별 직원과 연락처' }, clusters: [{ label: '규정', dynamic: 'policies', keys: ['rules'] }, { label: '관리', admin: true, keys: ['staff', 'alog'] }] }],
    sections: [{ key: 'org', label: '조직도', native: true }, { key: 'rules', label: '회사 내규', native: true }, { key: 'staff', label: '직원 관리', native: true }, { key: 'alog', label: '열람 기록', native: true }] },
  // 평가: 인사 모듈에서 분리한 독립 메뉴 — 내 평가(정직원 누구나, 폰에서도) · 평가 운영(사장단·관리자·"인사평가" 권한자). 인사 모듈은 관리자 전용이라 비관리자(인사총무팀 일부)에게 열면 급여·계약서 화면이 주소로 열릴 위험이 있어 따로 뺐다(설계서 docs/hr-evaluation-design.md 9-1절)
  { id: 'eval', order: 47, title: '평가', icon: '📝', tabbed: true, ownNav: true, perm: isEvalUser, nav: [{ key: 'mine', label: '내 평가' }], homeLabel: '평가',
    groups: [{ key: 'eval', label: '평가', home: { key: 'mine', label: '내 평가', hint: '나에게 배정된 평가를 폰에서도 작성합니다' }, clusters: [{ label: '평가 운영', perm: isEvalOps, keys: ['cycle', 'adhoc', 'result'] }] }],
    sections: [{ key: 'mine', label: '내 평가', native: true }, { key: 'cycle', label: '정기평가', native: true }, { key: 'adhoc', label: '수시평가', native: true }, { key: 'result', label: '평가 결과 통보', native: true }] },
  { id: 'pjt', order: 40, mobileTab: { order: 2, label: 'PJT', icon: '🏗️' }, title: 'PJT 관리', icon: '🏗️', tabbed: false, dynamicNav: true, defaultSub: 'home', nativeKeys: ['roster', 'home', 'ended'], nativeSubs: ['home', 'schedule', 'progress', 'attend', 'report', 'log', 'monthly', 'settings'], perm: (me) => !!(me && (me.admin || (me.perms && me.perms.pjt) || (Array.isArray(me.pjtKeys) && me.pjtKeys.length > 0))) },   // PJT 권한자·관리자, 또는 어느 프로젝트든 참여자로 지정된 사람
  { id: 'myteam', order: 90, title: '내 팀 공수표', icon: '👷', tabbed: false, url: 'team/', nativeKeys: ['main'],
    perm: (me) => !!(me && (me.admin || (Array.isArray(me.teamLeaderIds) && me.teamLeaderIds.length > 0))), nav: [{ key: 'main', label: '내 팀 공수표' }] }
];
export const defById = (id) => LEGACY_DEFS.find((d) => d.id === id) || null;

/** PJT 세부 메뉴: PJT 홈 → 프로젝트(종료되지 않은 것, 등록 순 — 모든 프로젝트가 같은 규칙) → 연명부(관리자) → 종료 PJT.
 *  프로젝트는 위 메뉴에서 고르면 새 화면(프로젝트 홈·일정·공정·출역·공수·공사일보·설정)이 열린다. dyn = { loaded, registry: [{ id, name, … 프로젝트 문서 }] } */
export function pjtNav(me, dyn) {
  const d = dyn || { registry: [] }; const loading = dyn && dyn.loaded === false;   // 프로젝트 정보를 아직 못 읽었으면 프로젝트 칩은 읽은 뒤에 보여 준다(참여자 지정 확인 전에는 숨김)
  const items = [{ key: 'home', label: 'PJT 홈', url: 'classic.html?embed=pjt-home' }];
  const can = (proj) => !dyn || dyn.loaded === undefined ? true : canAccessProject(me, proj);   // dyn 이 없던 옛 호출(시험)은 지금까지처럼 모두 보임
  if (!loading) (d.registry || []).forEach((r) => { if (can(r)) items.push({ key: r.id, label: r.name || 'PJT', url: '' }); });
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
  if (def.dynamicNav && dyn && dyn.loaded === false && isProjectKey(key)) return { key, label: 'PJT', url: '' };
  return it[0] || null;
}
/** 옛 페이지 주소: 기본 폴더 + 항목 주소 + via=portal(임베드 모드) + tab(탭형만) + admin=1(관리자). base 는 LEGACY_BASE 를 해석한 절대 주소 */
/** 프로젝트 아래의 새 화면 탭(순서대로) — 프로젝트 키는 shared/pjt-key.js 의 규칙(등록 id) */
export const PJT_SUB_LABELS = { home: '🏠 프로젝트 홈', schedule: '📅 일정 (새)', progress: '📊 공정 (새)', attend: '👷 출역·공수 (새)', report: '📝 공사일보 (새)', log: '🗂️ 이력 (새)', monthly: '📄 월간 보고서 (새)', settings: '⚙️ 설정' };
/** PJT 관리 사이드 내비게이션 구성(순수): PJT 홈 → 프로젝트 목록 → 보는 프로젝트의 화면들 → 근로자 연명부 → 종료 PJT.
 *  items = pjtNav 결과, activeKey = 'home' | 프로젝트 id | 'roster' | 'ended', sub = 프로젝트 화면(home·schedule·…) 또는 연명부의 _manday·_migrate. 모든 프로젝트가 같은 모양이다. */
export function pjtSideConfig(def, items, activeKey, sub, me) {
  const list = items || []; const enc = encodeURIComponent; const projects = list.filter((i) => isProjectKey(i.key)); const act = projects.find((p) => p.key === activeKey);
  const plain = (l) => String(l || '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/ \(새\)$/, '');   // 재무회계·인사총무처럼 메뉴 항목은 글자만(앞의 이모지·"(새)" 표기 없음)
  const sections = [{ title: '현황', items: [{ key: 'home', label: 'PJT 홈', href: '#/pjt/home', hint: '프로젝트 카드·통합 일정' }] }];
  if (projects.length) sections.push({ title: '프로젝트', items: projects.map((p) => ({ key: 'p/' + p.key, label: p.label, href: '#/pjt/' + enc(p.key) + '/home', active: p.key === activeKey })) });
  const subKey = (act && ((def.nativeSubs || []).indexOf(sub) !== -1 ? sub : def.defaultSub || 'home')) || '';
  if (act) sections.push({ title: act.label, kind: 'project', items: (def.nativeSubs || []).filter((s) => s !== 'settings' || (me && me.admin)).map((s) => ({ key: 's/' + s, label: plain(PJT_SUB_LABELS[s] || s), href: '#/pjt/' + enc(act.key) + '/' + s })) });   // 보는 프로젝트의 화면들(머리글 = 프로젝트 이름)
  if (list.some((i) => i.key === 'roster')) sections.push({ title: '근로자 연명부', items: [{ key: 'roster', label: '명부', href: '#/pjt/roster' }, { key: 'roster/_manday', label: '월간 공수', href: '#/pjt/roster/_manday' }, { key: 'roster/_migrate', label: '기존 인원 마이그레이션', href: '#/pjt/roster/_migrate' }] });
  sections.push({ title: '보관', items: [{ key: 'ended', label: '종료 PJT', href: '#/pjt/ended' }] });
  const current = act ? 's/' + subKey : activeKey === 'roster' ? (sub === '_manday' || sub === '_migrate' ? 'roster/' + sub : 'roster') : activeKey === 'ended' ? 'ended' : 'home';
  return { label: def.title + ' 메뉴', title: (def.icon ? def.icon + ' ' : '') + def.title, current, sections };
}
/** 옛 모듈 틀 안에서 살려 두는 화면의 키(작업 탭 하나). 화면이 아닌 값(문서 번호·날짜·근로자 id)은 넣지 않아 같은 화면이 여러 탭으로 불어나지 않는다.
 *  itemKey = 메뉴 항목(PJT 는 'home'·프로젝트 id·'roster'·'ended'), sub = 프로젝트 아래 화면, rawSub = 주소의 둘째 칸 */
export function nativeViewKey(defId, itemKey, sub, rawSub) {
  if (defId === 'hr' && itemKey === 'overtimes') itemKey = 'attendcal';   // 초과근로 현황은 출퇴근·초과근로 화면에 합쳐졌다(옛 주소도 같은 화면)
  if (defId === 'pjt') { if (isProjectKey(itemKey)) return '#/pjt/' + itemKey + '/' + (sub || 'home'); if (itemKey === 'roster') return '#/pjt/roster' + (rawSub && rawSub[0] === '_' ? '/' + rawSub : ''); return '#/pjt/' + itemKey; }
  return '#/' + defId + '/' + (itemKey || 'home');
}
export const PJT_TABS = ['attend', 'schedule'];   // 주소로 바로 열 수 있는 PJT 탭: 출역·공수 체크·일정
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
/** 사이드바의 현재 메뉴 항목. 회사 규정은 문서마다 항목(rules/<문서 id>)이다 */
export function sideCurrentKey(def, activeKey, sub) { if (activeKey === 'general') return 'general/' + (sub || 'home'); if (def.id === 'company' && activeKey === 'rules') return sub ? 'rules/' + sub : 'rules'; const g = (def.groups || []).find((x) => x.clusters && (x.clusters.some((c) => c.keys.includes(activeKey)) || (x.home && x.home.key === activeKey))); return g ? activeKey : ((def.groups || [])[0] && def.groups[0].home ? def.groups[0].home.key : 'home'); }   // 구역 안의 화면이거나 그 구역의 첫 화면(홈 — 회사는 'org')이면 그 화면, 아니면 첫 화면
export function sideConfig(def, activeKey, sub, me, dyn) {
  const labelOf = (k) => { const s = (def.sections || []).find((x) => x.key === k); return s ? s.label : k; };
  const sections = [];   // 재무회계 사이드바처럼 묶음마다 머리글 + 구분선: 인사 · 채용 · 입사 · 재직 · 변동 · 퇴사 · 총무
  def.groups.forEach((g) => {
    if (g.clusters) { const top = { title: g.label, items: g.home ? [{ key: g.home.key, label: g.home.label, href: '#/' + def.id + '/' + g.home.key, hint: g.home.hint }] : [] }; sections.push(top); g.clusters.forEach((c) => { if (c.admin && !(me && me.admin)) return; if (typeof c.perm === 'function' && !c.perm(me)) return; if (c.dynamic === 'policies' && dyn && dyn.policies && dyn.policies.length) { sections.push({ title: c.label, items: dyn.policies.map((p) => ({ key: 'rules/' + p.id, label: p.title || p.id, href: '#/' + def.id + '/rules/' + encodeURIComponent(p.id) })) }); return; }   // 규정 묶음: 서버에서 읽은 회사 내규 문서마다 한 항목(읽기 전에는 "회사 내규" 하나)
    const items = c.keys.map((k) => ({ key: k, label: labelOf(k), href: '#/' + def.id + '/' + k })); if (c.keys.length === 1 && labelOf(c.keys[0]) === c.label) top.items.push(items[0]); else sections.push({ title: c.label, items }); }); }   // 묶음 제목과 메뉴 이름이 같은 한 칸짜리 묶음(예: 프로젝트)은 맨 위 구역에 합친다
    else sections.push({ title: g.label, items: (g.items || []).map(([k, l]) => ({ key: g.key + '/' + k, label: l, href: '#/' + def.id + '/' + g.key + '/' + k })) });
  });
  return { label: def.title + ' 메뉴', title: (def.icon ? def.icon + ' ' : '') + def.title, current: sideCurrentKey(def, activeKey, sub), sections };
}
function groupNavHtml(def, activeKey, esc, sub, me, dyn) { return sidenavHtml(sideConfig(def, activeKey, sub, me, dyn), 'jh-legacy__nav'); }
export function navHtml(def, items, activeKey, esc, sub, me, dyn) {
  if (def.dynamicNav) return sidenavHtml(pjtSideConfig(def, items, activeKey, sub, me), 'jh-legacy__nav');   // PJT 관리도 영업기획·인사총무·재무회계와 같은 공용 사이드 내비게이션(너비 220px 동일)
  if (def.groups && def.groups.length) return groupNavHtml(def, activeKey, esc, sub, me, dyn);
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
  const d = dyn || { registry: [] }; const out = []; const can = (proj) => !me || !dyn || dyn.loaded === undefined ? true : canAccessProject(me, proj);   // 참여자로 지정되지 않은 프로젝트는 고르지 못한다
  (d.registry || []).forEach((r) => { if (can(r)) out.push({ key: r.id, label: r.name || 'PJT', hash: '#/pjt/' + encodeURIComponent(r.id) + '/attend' }); });   // 프로젝트 아래의 출역·공수 탭 — 모든 프로젝트 같은 규칙
  return out;
}
