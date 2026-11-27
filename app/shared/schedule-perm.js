/* 영업기획·재무회계 일정을 볼 수 있는 사람(대기열 4-6-23) — 보안 규칙(plan_schedules·finance_schedules)과 같은 기준. 순수 함수.
 * source: 'plan'(영업기획 일정) | 'finsch'(재무회계 일정). 영업기획 = 영업·기획·월말마감 칩 하나라도 · 재무회계 = 입력 권한(financeEdit)·관리자. */
import { planAccess } from './plan-perm.js?v=20261127g';
import { financeEditPerm } from './finance-perm.js?v=20261127g';
export const scheduleSourcePerm = (source, me) => (source === 'plan' ? planAccess(me) : source === 'finsch' ? financeEditPerm(me) : !!(me && me.admin));
