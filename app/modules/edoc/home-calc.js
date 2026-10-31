/* 전자결재 홈 계산 — 연차 부여·사용·잔여, 이번 달 근로시간(소정근로시간·유급휴가 반영).
 * 기존 전자결재(edoc/index.html)·인사(hr)와 같은 기준이며 로직은 그대로 옮겼다. 기준이 바뀌면 hr·edoc·m/edoc·이 파일을 함께 고친다.
 * 공휴일은 holidays.js(단일 출처)의 날짜 목록을 받아서 쓴다. */
import { isLeavePaid, computeLeaveHoursForMonth } from '../../shared/leave-hours.js?v=20261031f';
export { isLeavePaid, computeLeaveHoursForMonth };   // 공용(shared/leave-hours.js)으로 옮겼다. 다시 내보내 기존 불러오기는 그대로 동작한다.

import { calcLeaveBalance } from '../../shared/leave-calc.js?v=20261031f';
export { calcLeaveBalance };   // 연차 계산은 shared/leave-calc.js 로 옮겼다(인사 모듈과 함께 쓰기 위해). 이 파일에서 다시 내보내 기존 불러오기는 그대로 동작한다.

export const leaveDocsOf = (docs, me) => (docs || []).filter((d) => d.dtype === 'leave' && (d.authorUid === me.uid || (!d.authorUid && (d.authorName || d.name) === me.name)));

/** 연차에서 차감되는 휴가인지(연차·반차, 종류가 비어 있는 옛 문서 포함) */
export function isAnnualType(type) { const t = String(type || '').trim(); return !t || t.startsWith('연차') || t.startsWith('반차'); }

export { monthlyStandardHours, monthlyMaxOvertimeHours, worktimeSummary, findWorker } from '../../shared/worktime.js?v=20261031f';
