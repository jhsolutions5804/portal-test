/* 재무회계 권한(대기열 4-6-23, 대표님 2026-11-27) — 재무회계 모듈·공용 틀(옛 모듈 어댑터)·캘린더가 같은 판단을 쓴다. 순수 함수.
 * 관리자(4명 고정) · perms.financeEdit(입력) · perms.finance(조회). 부서(재무회계팀)로는 열리지 않는다 — 칩을 받은 사람만.
 * 구역: 조회 = 홈·재무제표·월간 수지·예측 / 입력 = 전표·비용 입력·가져오기·일정·프로젝트 표시(+조회 전부) / 관리자 = 이엔지 정산·규칙·개시 재산·설정.
 * 보안 규칙(isFinanceUser·isFinanceEditor)과 서버 함수(ledgerAct)가 같은 기준으로 실제 데이터를 막는다 — 화면 숨김만으로는 막지 않는다. */
const ok = (me) => !!me && !me.isGuest;
const chip = (me, k) => !!(me && me.perms && me.perms[k] === true);
export const financeAdmin = (me) => ok(me) && me.admin === true;
/** 입력 권한: 관리자 또는 financeEdit 칩 */
export const financeEditPerm = (me) => ok(me) && (me.admin === true || chip(me, 'financeEdit'));
/** 입구(조회 이상): 관리자·financeEdit·finance */
export const financePerm = (me) => financeEditPerm(me) || (ok(me) && chip(me, 'finance'));
const ADMIN_ONLY = ['gap', 'rules', 'opening', 'settings'], EDIT = ['entries', 'expense', 'import', 'schedule', 'pjt'], VIEW = ['home', 'reports', 'monthly', 'forecast'];
/** 화면 key → 열 수 있는지. 모르는 화면은 관리자만 */
export function financeSectionAllowed(me, section) {
  if (financeAdmin(me)) return true;
  if (VIEW.indexOf(section) !== -1) return financePerm(me);
  if (EDIT.indexOf(section) !== -1) return financeEditPerm(me);
  return false;   // ADMIN_ONLY 와 모르는 값
}
export const financeLanding = (me) => (financePerm(me) ? 'home' : '');
export const FINANCE_ADMIN_ONLY = ADMIN_ONLY;
