/* 인사총무 구역별 조회 권한(대기열 1-3-238, 설계서 app-docs/hr-section-permissions-design.md) — 화면·네트워크 없이 시험한다.
 * 대표님 결정(2026-11-16): 채용·입사·재직·변동·퇴사 묶음은 권한을 따로 주지 않고 전부 민감정보(관리자 전용).
 *   연차 현황은 따로 빼서 연차 조회 권한(hrLeave)으로, 총무는 총무 권한(hrAffairs) 하나로 연다.
 * 보안 규칙(firestore.*.rules 의 hasHrPerm)이 같은 키로 실제 데이터 접근을 막는다 — 화면 숨김만으로는 막지 않는다. */
export const HR_KEYS = { affairs: 'hrAffairs', leave: 'hrLeave' };
const key = (me, k) => !!(me && !me.isGuest && me.perms && me.perms[k] === true);
export const hrIsAdmin = (me) => !!(me && me.admin === true);
export const hrAffairsPerm = (me) => hrIsAdmin(me) || key(me, HR_KEYS.affairs);
export const hrLeavePerm = (me) => hrIsAdmin(me) || key(me, HR_KEYS.leave);
/** 인사총무 입구: 관리자이거나 두 키 중 하나가 있는 계정 */
export const hrAccess = (me) => hrAffairsPerm(me) || hrLeavePerm(me);
/** 화면 key(인사총무 주소의 첫 칸) → 열 수 있는지. 'general' = 총무 구역 전체, 'leaves' = 연차 현황, 그 밖의 모든 화면(홈 포함)은 관리자만 */
export function hrSectionAllowed(me, section) {
  if (hrIsAdmin(me)) return true;
  if (section === 'general') return hrAffairsPerm(me);
  if (section === 'leaves') return hrLeavePerm(me);
  return false;
}
/** 처음 열 화면: 관리자 = 인사 홈, 총무 권한 = 총무, 연차 권한만 = 연차 현황, 없으면 '' */
export const hrLanding = (me) => (hrIsAdmin(me) ? 'home' : hrAffairsPerm(me) ? 'general' : hrLeavePerm(me) ? 'leaves' : '');
