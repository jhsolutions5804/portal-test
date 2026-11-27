/* 영업기획 구역별 권한(대기열 4-6-23, 설계서 portal-functions app-docs/perm-plan-finance-design.md) — 화면·네트워크 없이 시험한다.
 * 대표님 결정(2026-11-27): 관리자 4명은 고정, 나머지는 직원 관리에서 칩(영업·기획·월말마감)을 받은 사람만 그 구역을 본다(부서로 자동 허용하지 않음).
 *   프로젝트 마진은 영업기획팀(부서) 소속과 관리자만 본다.
 * 구역: 영업 = 거래처·견적·청구·수금 / 기획 = 지급·정산·팀별 노무비·협력사·위탁 계약서 / 월말마감 = 월말 마감·월간 보고서·비용장부 대조.
 * 홈·프로젝트·일정은 칩이 하나라도 있으면 열린다. 보안 규칙(firestore.*.rules 의 hasPlanKey)이 같은 키로 실제 데이터를 막는다 — 화면 숨김만으로는 막지 않는다. */
export const PLAN_KEYS = { sales: 'planSales', plan: 'planPlan', close: 'planClose' };
const key = (me, k) => !!(me && !me.isGuest && me.perms && me.perms[k] === true);
export const planIsAdmin = (me) => !!(me && me.admin === true);
export const planSalesPerm = (me) => planIsAdmin(me) || key(me, PLAN_KEYS.sales);
export const planPlanPerm = (me) => planIsAdmin(me) || key(me, PLAN_KEYS.plan);
export const planClosePerm = (me) => planIsAdmin(me) || key(me, PLAN_KEYS.close);
/** 영업기획 입구: 관리자이거나 세 칩 중 하나라도 있는 계정 */
export const planAccess = (me) => planSalesPerm(me) || planPlanPerm(me) || planClosePerm(me);
const SECTION_KEY = { comp: 'sales', est: 'sales', billing: 'sales', payout: 'plan', teamlabor: 'plan', partners: 'plan', contracts: 'plan', closing: 'close', monthly: 'close', acct: 'close' };
const COMMON = ['home', 'projects', 'schedule'];
/** 화면 key(영업기획 주소의 첫 칸) → 열 수 있는지. 홈·프로젝트·일정 = 입구 권한자 누구나, 구역 화면 = 그 구역 칩, 모르는 화면 = 관리자만 */
export function planSectionAllowed(me, section) {
  if (planIsAdmin(me)) return true;
  if (COMMON.indexOf(section) !== -1) return planAccess(me);
  const g = SECTION_KEY[section]; return g ? key(me, PLAN_KEYS[g]) : false;
}
/** 처음 열 화면: 입구 권한이 있으면 홈, 없으면 '' */
export const planLanding = (me) => (planAccess(me) ? 'home' : '');
/** 프로젝트 마진(원가·이익) 열람: 관리자와 영업기획팀 소속(칩과 무관 — 대표님 11/27) */
export const planMarginPerm = (me) => planIsAdmin(me) || (!!me && !me.isGuest && String(me.dept || '').trim() === '영업기획팀');
