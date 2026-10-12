/* 유급휴가 → 근무시간 환산(1일=8h, 반차=4h) — 전자결재 홈과 인사(출퇴근 달력·급여)가 같은 계산을 쓰도록 공용으로 둔다.
 * 승인·게시된 유급 휴가만 인정하고, 해당 연월에 속하는 날짜만 센다. 무급 휴가(생리휴가·육아휴직·가족돌봄휴가·병가)는 제외. */
export const LEAVE_PAID_MAP = {
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
