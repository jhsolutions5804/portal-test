/* 전자결재 홈 계산 — 연차 부여·사용·잔여, 이번 달 근로시간(소정근로시간·유급휴가 반영).
 * 기존 전자결재(edoc/index.html)·인사(hr)와 같은 기준이며 로직은 그대로 옮겼다. 기준이 바뀌면 hr·edoc·m/edoc·이 파일을 함께 고친다.
 * 공휴일은 holidays.js(단일 출처)의 날짜 목록을 받아서 쓴다. */
import { calcLeaveBalance } from '../../shared/leave-calc.js?v=20261012f';
export { calcLeaveBalance };   // 연차 계산은 shared/leave-calc.js 로 옮겼다(인사 모듈과 함께 쓰기 위해). 이 파일에서 다시 내보내 기존 불러오기는 그대로 동작한다.

const LEAVE_PAID_MAP = {
  '연차': true, '반차-오전': true, '반차-오후': true, '반차': true,
  '생리휴가': false,
  '출산전후휴가': true, '배우자출산휴가': true, '유산·사산휴가': true,
  '육아휴직': false, '가족돌봄휴가': false,
  '병가': false, // 무급 전환(2026-08-30)
  '예비군/민방위': true,
  '경조사': true, // 예전 방식 휴가명 — 유급 처리(재확인 필요)
};
export function isLeavePaid(leaveType) {
  const base = (leaveType || '').replace(/\(.+?\)/g, '').trim();
  if (base in LEAVE_PAID_MAP) return LEAVE_PAID_MAP[base];
  return /\(유급\)/.test(leaveType || '');
}

export function computeLeaveHoursForMonth(leaveDocs, workerName, year, month) {
  const ym = year + '-' + String(month).padStart(2,'0');
  let hours = 0;
  for (const lv of leaveDocs) {
    const nm = lv.authorName || lv.name || '';
    if (nm !== workerName) continue;
    if (lv.status !== 'posted' && lv.status !== 'approved') continue;
    if (!isLeavePaid(lv.leaveType)) continue; // 무급 휴가 제외
    if (!lv.startDate || !lv.endDate) continue;
    const perDay = (/반차/.test(lv.leaveType || '') || lv.days === 0.5 || lv.leaveDays === 0.5) ? 4 : 8;
    const cur = new Date(lv.startDate);
    const end = new Date(lv.endDate);
    while (cur <= end) {
      const key = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0');
      if (key === ym) hours += perDay;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return hours;
}

export const leaveDocsOf = (docs, me) => (docs || []).filter((d) => d.dtype === 'leave' && (d.authorUid === me.uid || (!d.authorUid && (d.authorName || d.name) === me.name)));

/** 연차에서 차감되는 휴가인지(연차·반차, 종류가 비어 있는 옛 문서 포함) */
export function isAnnualType(type) { const t = String(type || '').trim(); return !t || t.startsWith('연차') || t.startsWith('반차'); }

export { monthlyStandardHours, monthlyMaxOvertimeHours, worktimeSummary, findWorker } from '../../shared/worktime.js?v=20261012f';
