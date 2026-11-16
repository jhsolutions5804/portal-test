// 인사총무 구역별 권한(대기열 1-3-238) — 판정 함수·사이드 메뉴·직접 주소 막기. 보안 규칙은 portal-functions/rules-tests/hr_section_perms.test.mjs 가 시험한다.
import { hrAccess, hrSectionAllowed, hrLanding, hrAffairsPerm, hrLeavePerm } from '../app/shared/hr-perm.js';
import { LEGACY_DEFS, sideConfig, resolveItem } from '../app/modules/legacy/list.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const adm = { admin: true }, aff = { perms: { hrAffairs: true } }, lv = { perms: { hrLeave: true } }, both = { perms: { hrAffairs: true, hrLeave: true } }, hrOnly = { perms: { hr: true } }, none = { perms: {} }, gst = { isGuest: true, perms: { hrAffairs: true } };
ok(hrAccess(adm) && hrAccess(aff) && hrAccess(lv) && hrAccess(both) && !hrAccess(hrOnly) && !hrAccess(none) && !hrAccess(gst) && !hrAccess(null), '입구: 관리자·총무·연차 키만. hr 모듈 키만·키 없음·GUEST·비로그인은 못 들어옴');
ok(hrAffairsPerm(aff) && !hrAffairsPerm(lv) && hrLeavePerm(lv) && !hrLeavePerm(aff) && hrAffairsPerm(adm) && hrLeavePerm(adm), '키별 판정: 총무는 총무만, 연차는 연차만, 관리자는 둘 다');
ok(hrSectionAllowed(adm, 'workers') && hrSectionAllowed(adm, 'home') && hrSectionAllowed(adm, 'general') && hrSectionAllowed(adm, 'leaves'), '관리자는 모든 화면');
const SENSITIVE = ['home', 'workers', 'applicants', 'postings', 'offers', 'laborc', 'annualc', 'change', 'resignreqs', 'retire', 'dismissal', 'payslips', 'ledger', 'insurance', 'evals', 'interviews', 'salarytable', 'attendcal', 'overtimes', 'leavepromo', 'hrcal'];
ok(SENSITIVE.every((k) => !hrSectionAllowed(aff, k) && !hrSectionAllowed(lv, k) && !hrSectionAllowed(both, k)), '★ 채용·입사·재직(연차 현황 제외)·변동·퇴사·급여·평가 화면은 두 키를 다 가져도 못 엶(관리자 전용)');
ok(hrSectionAllowed(aff, 'general') && !hrSectionAllowed(aff, 'leaves') && hrSectionAllowed(lv, 'leaves') && !hrSectionAllowed(lv, 'general') && hrSectionAllowed(both, 'general') && hrSectionAllowed(both, 'leaves'), '총무 키 = 총무 구역만, 연차 키 = 연차 현황만');
ok(hrLanding(adm) === 'home' && hrLanding(aff) === 'general' && hrLanding(lv) === 'leaves' && hrLanding(both) === 'general' && hrLanding(none) === '', '처음 열 화면');
const hr = LEGACY_DEFS.find((d) => d.id === 'hr');
ok(hr.perm(adm) && hr.perm(aff) && hr.perm(lv) && !hr.perm(none) && !hr.perm(hrOnly), '인사총무 입구 판정(def.perm)이 hrAccess 와 같게 동작');
const titles = (me) => sideConfig(hr, 'home', '', me).sections.map((s) => s.title).join();
const keysOf = (me) => sideConfig(hr, 'home', '', me).sections.flatMap((s) => s.items.map((i) => i.key));
ok(titles(adm) === '인사,채용,입사,재직,변동,퇴사,총무', '관리자 메뉴는 그대로(회귀)');
ok(keysOf(lv).join() === 'leaves' && titles(lv) === '재직', '★ 연차 권한: 메뉴에 "연차 현황" 하나만(재직 묶음 안, 나머지 묶음·홈·총무는 사라짐)');
ok(titles(aff) === '총무' && keysOf(aff).every((k) => k.startsWith('general/')) && keysOf(aff).length === 7, '★ 총무 권한: 총무 메뉴 7개만');
ok(titles(both) === '재직,총무' && keysOf(both).includes('leaves') && keysOf(both).includes('general/vehicle') && !keysOf(both).includes('payslips'), '두 키: 연차 현황 + 총무');
// 직접 주소: 못 여는 화면은 열 수 있는 첫 화면으로 돌아간다
const r = (me, key) => (resolveItem(hr, key, me) || {}).key;
ok(r(adm, 'workers') === 'workers' && r(adm, 'payslips') === 'payslips', '관리자는 주소대로 연다(회귀)');
ok(r(lv, 'payslips') === 'leaves' && r(lv, 'workers') === 'leaves' && r(lv, 'home') === 'leaves' && r(lv, 'general') === 'leaves' && r(lv, 'leaves') === 'leaves' && r(lv, '') === 'leaves', '★ 연차 권한이 주소로 급여명세서·명부·홈·총무를 쳐도 연차 현황으로 돌아감');
ok(r(aff, 'payslips') === 'general' && r(aff, 'leaves') === 'general' && r(aff, 'general') === 'general' && r(aff, 'workers') === 'general', '★ 총무 권한이 주소로 급여명세서·연차·명부를 쳐도 총무로 돌아감');
ok(r(both, 'leaves') === 'leaves' && r(both, 'general') === 'general' && r(both, 'retire') === 'general', '두 키: 열 수 있는 화면은 그대로, 나머지는 총무로');
ok(resolveItem(hr, 'workers', none) === null && resolveItem(hr, 'workers', hrOnly) === null, '권한이 없으면 열 화면 없음(null)');
ok(r(adm, '../x') === 'home', '형식이 틀린 주소 값은 홈으로(관리자)');
// 연차 현황 화면: 조회 전용 모드에서는 등록·수정·삭제·연차사용촉진 단추가 없다
const { leaveHtml } = await import('../app/modules/hr/view.js');
const row = { id: 'w1', name: '홍길동', dept: '인사총무팀', rank: '사원', hireDate: '2024-01-01', detail: '회계연도', granted: 15, used: 3, planned: 0, remain: 12, resigned: false, tracks: [], docs: [{ id: 'L1', status: 'approved', authorName: '홍길동', startDate: '2026-11-20', endDate: '2026-11-20', days: 1, leaveType: '연차', title: '20261120 홍길동 연차 신청서', adminCreated: true }] };
const mkSt = (readOnly) => ({ readOnly, workers: [], lvForm: null, lvEdit: null, leaveRows: [row], leaveSel: 'w1', leaveAll: false, pg: {}, today: '2026-11-16' });
const fullH = leaveHtml(mkSt(false)), roH = leaveHtml(mkSt(true));
ok(fullH.includes('data-l-new') && fullH.includes('data-l-edit') && fullH.includes('leavepromo'), '관리자 화면에는 등록·수정·삭제·연차사용촉진이 있음(회귀)');
ok(roH.includes('홍길동') && roH.includes('12') && !roH.includes('data-l-new') && !roH.includes('data-l-edit') && !roH.includes('data-l-del') && !roH.includes('leavepromo'), '★ 조회 전용 화면: 잔여 연차는 보이고 등록·수정·삭제·연차사용촉진 단추는 없음');
console.log('\n통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
